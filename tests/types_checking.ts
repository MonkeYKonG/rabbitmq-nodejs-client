import RabbitMQClient, { MessagesDefinition } from "../src/rabbitmq";

enum enumOne {
  ONE_ONE = 'one_one',
  ONE_TWO = 'one_two',
}

enum enumTwo {
  TWO_ONE = 'two_one',
  TWO_TWO = 'two_two',
}

type Command<T extends string = string, U = any> = {
  command: T;
  args: U;
};

type MessageTypeOne = {
  [enumOne.ONE_ONE]: [
    {
      argument: Command<'hey', { a: string, b: number }>,
      return: void,
    },
    {
      argument: Command<'salut', { c: string, d: number }>,
      return: void,
    },
  ];
  [enumOne.ONE_TWO]: [
    {
      argument: Command<'Earth', { e: boolean, f: number }>,
      return: void,
    },
    {
      argument: Command<'Terre', { g: string, h: number }>,
      return: void,
    },
  ];
}


type MessageTypeTwo = {
  [enumTwo.TWO_ONE]: {
    'marco': { argument: boolean, return: void },
    'james': { argument: string, return: void }
  };
  [enumTwo.TWO_TWO]: {
    'pollo': { argument: number, return: void },
    'cook': { argument: string, return: void }
  };
}

type Arguments = MessageTypeOne & MessageTypeTwo;
type Definitions = MessagesDefinition<Arguments>;

const main = async () => {
  const channel = await RabbitMQClient.createChannel<Definitions>();

  const senderOne = await channel.createSender(
    enumOne.ONE_ONE,
  );
  const senderTwo = await channel.createSender(
    enumTwo.TWO_TWO,
  );

  senderOne.send({ command: 'hey', args: { a: 'gello', b: 23 } });
  senderOne.send({ command: 'salut', args: { c: 'gello', d: 23 } });
  senderTwo.send('hello');
  senderTwo.send(12);

  await channel.createReceiver(enumOne.ONE_ONE, (message) => {
    console.log(message.content);
  });

  await channel.createReceiver(enumTwo.TWO_TWO, (message) => {
    message.content;
  });

  await channel.close();
};

const main2 = async () => {
  const channel = await RabbitMQClient.createChannel<Definitions>();

  const publisherOne = await channel.createPublisher(
    enumOne.ONE_TWO,
    'fanout',
  );
  const publisherTwo = await channel.createPublisher(
    enumTwo.TWO_ONE,
    'fanout',
  );

  publisherOne.publish({ command: 'Earth', args: { e: true, f: 54 } });
  publisherTwo.publish('hello');
  publisherTwo.publish(false);

  await channel.createSubscriber(
    enumOne.ONE_TWO,
    'fanout',
    (message) => {
      message.content;
    });

  await channel.createSubscriber(
    enumTwo.TWO_ONE,
    'fanout',
    (message) => {
      message.content;
    });

  await channel.close();
};

type ErrorReturn<T extends boolean> = { error: T };
type SuccessReturn = ErrorReturn<false>;
type FailureReturn = ErrorReturn<true>;

type MessageTypeOneRPC = {
  [enumOne.ONE_ONE]: {
    'hello': {
      argument: Command<'hey', { a: string, b: number }>,
      return: SuccessReturn,
    },
    'bonjour': {
      argument: Command<'salut', { c: string, d: number }>,
      return: FailureReturn,
    },
  };
  [enumOne.ONE_TWO]: {
    'World': {
      argument: Command<'Earth', { e: boolean, f: number }>,
      return: FailureReturn,
    },
    'Monde': {
      argument: Command<'Terre', { g: string, h: number }>,
      return: SuccessReturn,
    },
  };
}

type MessageTypeTwoRPC = {
  [enumTwo.TWO_ONE]: {
    'marco': { argument: boolean, return: FailureReturn & { a: boolean } },
    'james': { argument: string, return: FailureReturn & { b: string } }
  };
  [enumTwo.TWO_TWO]: {
    'pollo': { argument: number, return: SuccessReturn & { c: number } },
    'cook': { argument: string, return: SuccessReturn & { d: string | number } }
  };
}

type ArgumentsRPC = MessageTypeOneRPC & MessageTypeTwoRPC;

const main3 = async () => {
  const channel = await RabbitMQClient.createChannel<ArgumentsRPC>();

  const senderOne = await channel.createSender(enumOne.ONE_ONE);
  const senderTwo = await channel.createSender(enumTwo.TWO_TWO);

  const responseOne1 = await senderOne.sendRPC({ command: 'hey', args: { a: 'gello', b: 12 } });
  const responseOne2 = await senderOne.sendRPC({ command: 'salut', args: { c: 'hello', d: 22 } });
  const responseTwo1 = await senderTwo.sendRPC('hello');
  const responseTwo2 = await senderTwo.sendRPC(12);

  await channel.createReceiver(enumOne.ONE_TWO, (message) => {
    message.content;
    switch (message.content.command) {
      case 'Earth':
        return { error: true };

      case 'Terre':
        return { error: true }; // TODO: Must be false
    }
  });

  await channel.createReceiver(enumTwo.TWO_ONE, (message) => {
    message.content;

    return { error: true, b: 'true' };
  });
};

const main4 = async () => {
  const channel = await RabbitMQClient.createChannel();

  const sender = await channel.createSender('test1');
  const publisher = await channel.createPublisher('test2', 'fanout');

  sender.send('coucou');
  publisher.publish('coucou');

  const response = await sender.sendRPC('Hello world!');

  const receiver = channel.createReceiver('test1', (message) => {
    message.content;

    return message.content;
  });
  const subscriber = channel.createSubscriber('test2', 'fanout', (message) => {
    message.content;

    return message.content;
  })
};

RabbitMQClient.connect().then(() => {
  Promise.all([
    main(),
    main2(),
    main3(),
    main4(),
  ]).then(() => {
    RabbitMQClient.close();
  });
});
