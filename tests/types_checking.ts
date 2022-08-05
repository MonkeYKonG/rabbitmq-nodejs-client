import RabbitMQClient, { BaseSendersReceivers } from "../src/rabbitmq";

enum enumOne {
  ONE_ONE = 'one_one',
  ONE_TWO = 'one_two',
}

enum enumTwo {
  TWO_ONE = 'two_one',
  TWO_TWO = 'two_two',
}

type MessageTypeOne = {
  [enumOne.ONE_ONE]: {
    'hello': { argument: string, return: void },
    'bonjour': { argument: string, return: void },
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

type MKeys = {
  [key in keyof MessageTypeOne]: keyof MessageTypeOne[key];
}

// type SenderReceiverOne = BaseSendersReceivers<enumOne, MessageTypeOne>;
type SenderReceiverOne = BaseSendersReceivers<MessageTypeOne>;
// type SenderReceiverTwo = BaseSendersReceivers<enumTwo, MessageTypeTwo>;
type SenderReceiverTwo = BaseSendersReceivers<MessageTypeTwo>;

type SendersReceivers = SenderReceiverOne & SenderReceiverTwo;

const main = async () => {
  const channel = await RabbitMQClient.createChannel<SenderReceiverOne>();
  const channel2 = await RabbitMQClient.createChannel<SenderReceiverTwo>();
  const channelBoth = await RabbitMQClient.createChannel<SendersReceivers>();

  // const senderOne = await RabbitMQClient.createSender<SendersReceivers>(
  //   enumOne.ONE_ONE,
  //   channel,
  // );
  // const senderTwo = await RabbitMQClient.createSender<SendersReceivers>(
  //   enumTwo.TWO_TWO,
  //   channel,
  // );

  // senderOne.queue.send('string');
  // senderTwo.queue.send({ d: "hello" });

  // await RabbitMQClient.createReceiver<SendersReceivers[enumOne.ONE_ONE]>(enumOne.ONE_ONE, (message) => {
  //   message.content.a;
  // });

  // await RabbitMQClient.createReceiver<SendersReceivers[enumTwo.TWO_TWO]>(enumTwo.TWO_TWO, (message) => {
  //   message.content.d;
  // });

  // await channel.close();
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
