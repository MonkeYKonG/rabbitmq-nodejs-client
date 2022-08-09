import RabbitMQClient, { ArgumentBody, MessagesDefinition } from "../src/rabbitmq";

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
    ArgumentBody<Command<'cmd_a', { a: string, b: number }>, void>,
    ArgumentBody<Command<'cmd_b', { c: string, d: number }>, void>,
  ];
  [enumOne.ONE_TWO]: [
    ArgumentBody<Command<'cmd_c', { e: boolean, f: number }>, void>,
    ArgumentBody<Command<'cmd_d', { g: string, h: number }>, void>,
  ];
}


type MessageTypeTwo = {
  [enumTwo.TWO_ONE]: {
    'cmd_name_a': ArgumentBody<boolean, void>,
    'cmd_name_b': ArgumentBody<string, void>,
  };
  [enumTwo.TWO_TWO]: {
    'cmd_name_b': ArgumentBody<number, void>,
    'cmd_name_c': ArgumentBody<string, void>,
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

  senderOne.send({ command: 'cmd_a', args: { a: 'gello', b: 23 } });
  senderOne.send({ command: 'cmd_b', args: { c: 'gello', d: 23 } });
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

  publisherOne.publish({ command: 'cmd_c', args: { e: true, f: 54 } });
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

type MessageTypeRPCOne = {
  [enumOne.ONE_ONE]: [
    ArgumentBody<Command<'cmd_a', { a: string, b: number }>, SuccessReturn & { a: string }>,
    ArgumentBody<Command<'cmd_b', { c: string, d: number }>, SuccessReturn & { b: number }>,
  ];
  [enumOne.ONE_TWO]: [
    ArgumentBody<Command<'cmd_c', { e: boolean, f: number }>, SuccessReturn | FailureReturn>,
    ArgumentBody<Command<'cmd_d', { g: string, h: number }>, FailureReturn & { message: string }>,
  ];
}


type MessageTypeRPCTwo = {
  [enumTwo.TWO_ONE]: {
    'cmd_name_a': ArgumentBody<boolean, string>,
    'cmd_name_b': ArgumentBody<string, number>,
  };
  [enumTwo.TWO_TWO]: {
    'cmd_name_b': ArgumentBody<number, number>,
    'cmd_name_c': ArgumentBody<string, string>,
  };
}

type ArgumentsRPC = MessageTypeRPCOne & MessageTypeRPCTwo;
type DefinitionsRPC = MessagesDefinition<ArgumentsRPC>;

const main3 = async () => {
  const channel = await RabbitMQClient.createChannel<DefinitionsRPC>();

  const senderOne = await channel.createSender(enumOne.ONE_ONE);
  const senderTwo = await channel.createSender(enumTwo.TWO_TWO);

  const responseOne1 = await senderOne.sendRPC({ command: 'cmd_a', args: { a: 'gello', b: 12 } });
  const responseOne2 = await senderOne.sendRPC({ command: 'cmd_b', args: { c: 'hello', d: 22 } });
  const responseTwo1 = await senderTwo.sendRPC('hello');
  const responseTwo2 = await senderTwo.sendRPC(12);

  await channel.createReceiverRPC(enumOne.ONE_TWO, (message) => {
    switch (message.content.command) {
      case 'cmd_c':
        return {
          error: false,
          a: 'hello',
        }

      case 'cmd_d':
        return {
          error: false,
          b: 12,
        }
    }
  });

  await channel.createReceiverRPC(enumTwo.TWO_ONE, (message) => {
    if (message.content === true || message.content === false) {
      return 'success';
    }
    return 42;
  });

  await channel.close();
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
  });

  await channel.close();
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
