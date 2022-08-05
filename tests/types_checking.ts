import RabbitMQClient, { ParamIntersection, ParsedMessage } from "../src/rabbitmq";

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
  [enumOne.ONE_ONE]: {
    'hello': {
      argument: Command<'hey', { a: string, b: number }>,
      return: void,
    },
    'bonjour': {
      argument: Command<'salut', { c: string, d: number }>,
      return: void,
    },
  };
  [enumOne.ONE_TWO]: {
    'World': {
      argument: Command<'Earth', { e: boolean, f: number }>,
      return: void,
    },
    'Monde': {
      argument: Command<'Terre', { g: string, h: number }>,
      return: void,
    },
  };
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

const main = async () => {
  const channel = await RabbitMQClient.createChannel<Arguments>();

  const senderOne = await channel.assertQueue(
    enumOne.ONE_ONE,
  );
  const senderTwo = await channel.assertQueue(
    enumTwo.TWO_TWO,
  );

  senderOne.send({ command: 'hey', args: { a: 'gello', b: 23 } });
  senderOne.send({ command: 'salut', args: { c: 'gello', d: 23 } });

  await channel.createReceiver(enumOne.ONE_ONE, (message) => {
    console.log(message.content);
  });

  await channel.createReceiver(enumTwo.TWO_TWO, (message) => {
    message.content;
  });

  await channel.close();
};

const main2 = async () => {
  const channel = await RabbitMQClient.createChannel<Arguments>();

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

// const main3 = async () => {

// };

RabbitMQClient.connect().then(() => {
  Promise.all([
    main(),
    // main2(),
  ]).then(() => {
    RabbitMQClient.close();
  });
});
