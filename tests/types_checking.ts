import RabbitMQClient, { BaseSendersReceivers, ParamIntersection, ParsedMessage } from "../src/rabbitmq";

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
    'World': { argument: string, return: void },
    'Monde': { argument: number, return: void },
  };
}

type MessageTypeTwo = {
  [enumTwo.TWO_ONE]: {
    'marco': { argument: string, return: void },
    'james': { argument: string, return: void }
  };
  [enumTwo.TWO_TWO]: {
    'pollo': { argument: string, return: void },
    'cook': { argument: string, return: void }
  };
}

type SenderReceiverOne = BaseSendersReceivers<MessageTypeOne>;
type SenderReceiverTwo = BaseSendersReceivers<MessageTypeTwo>;

type SendersReceivers = SenderReceiverOne & SenderReceiverTwo;

const main = async () => {
  const channel = await RabbitMQClient.createChannel<SendersReceivers>();

  const senderOne = await channel.assertQueue(
    enumOne.ONE_ONE,
  );
  const senderTwo = await channel.assertQueue(
    enumTwo.TWO_TWO,
  );

  senderOne.send({ command: 'hey', args: { a: 'gello', b: 23 } });
  senderOne.send({ command: 'salut', args: { c: 'gello', d: 23 } });

  await channel.createReceiverOverload(enumOne.ONE_ONE, (message) => {

  });

  await channel.createReceiver(
    enumOne.ONE_ONE,
    (message) => {
      switch (message.command) {
        case 'hey':
          message.command;
      }
    },
  );

  await RabbitMQClient.createReceiver<SendersReceivers, enumTwo.TWO_TWO>(enumTwo.TWO_TWO, (message) => {
    message.content;
  });

  await channel.close();
};

// const main2 = async () => {
//   const channel = await RabbitMQClient.createChannel<SendersReceivers>();

//   const senderOne = await RabbitMQClient.createPublisher<SendersReceivers[enumOne.ONE_TWO]>(
//     enumOne.ONE_TWO,
//     'fanout',
//     channel,
//   );
//   const senderTwo = await RabbitMQClient.createPublisher<SendersReceivers[enumTwo.TWO_ONE]>(
//     enumTwo.TWO_ONE,
//     'fanout',
//     channel,
//   );

//   senderOne.exchange.publish({ b: "hello" });
//   senderTwo.exchange.publish({ c: "hello" });

//   await RabbitMQClient.createSubscriber<SendersReceivers[enumOne.ONE_TWO]>(
//     enumOne.ONE_TWO,
//     'fanout',
//     (message) => {
//       message.content.b;
//     });

//   await RabbitMQClient.createSubscriber<SendersReceivers[enumTwo.TWO_ONE]>(
//     enumTwo.TWO_ONE,
//     'fanout',
//     (message) => {
//       message.content.c;
//     });
// };

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
