/* eslint-disable max-len */
/* eslint-disable max-classes-per-file */
import * as dotenv from 'dotenv';
import amqp from 'amqplib/callback_api';
import { v4 as uuidV4 } from 'uuid';

import { RABBITMQ } from './errors';

dotenv.config();

export type ParamIntersection<T> = {
  [K in keyof T]: (x: T[K]) => any
}[keyof T] extends
  (x: infer I) => any ? I : never;

export type ParamMerged<T> = {
  [K in keyof T]: (x: T[K]) => void
}[keyof T] extends
  (x: infer I) => void ? { [K in keyof I]: I[K] } : never;

type KeyOf = string | number | symbol;
type BaseQueueName = string;

interface BaseArgumentBody<Args extends any = any, Return extends any = any> {
  argument: Args;
  return: Return;
}
type BaseArgument<Keys extends KeyOf = KeyOf> = {
  [k in Keys]: BaseArgumentBody<any, void>;
}
type BaseArgumentRPC<Keys extends KeyOf = KeyOf> = {
  [k in Keys]: BaseArgumentBody<any, any>;
};

export type BaseArguments<
  T extends KeyOf,
  U extends { [key in T]: string } = { [key in T]: string }
  > = {
    [key in T]: BaseArgument<U[key]>
  };
// export type BaseArguments<
//   T extends KeyOf,
//   U extends { [key in T]: string } = { [key in T]: string }
//   > = {
//     [key in T]: {
//       [k in U[key]]: {
//         argument: any;
//         return: void;
//       }
//     }
//   };
// type BaseArgumentsRPC<T extends BaseQueueName> = Record<T, BaseArgumentRPC>;

type SendToQueueMessage = any;

type Queues = Record<string, IQueue<any, any>>;

type ExchangeTypes = 'fanout' | 'direct' | 'topic' | 'header';
type Exchanges = Record<string, IExchange<any, any>>;

export type ParsedMessage<T> = Omit<amqp.Message, 'content'> & {
  content: T
};

type BaseSendFunction<T extends BaseArgumentBody> = (
  message: T['argument'],
) => void;
export type BaseSendFunctions<
  Argument extends BaseArgument,
  > = {
    [key in keyof Argument]: BaseSendFunction<Argument[key]>;
  };

export type BaseSendRPCFunctions<
  Argument extends BaseArgumentRPC,
  > = {
    [key in keyof Argument]: (
      message: Argument[key]['argument'],
    ) => Promise<Argument[key]['return']>;
  };

// export type BaseConsumeFunction<T extends BaseArgumentBody> = (
//   message: ParsedMessage<T['argument']>
// ) => T['return'] | Promise<T['return']>;
export type BaseConsumeFunction<
  Argument extends BaseArgument,
  > = (
    message: ParsedMessage<Argument[keyof Argument]['argument']>,
  ) => void | Promise<void>;

// export type BaseConsumeRPCFunction<
//   Argument extends BaseArgumentRPC,
//   > = {
//     [key in keyof Argument]: (
//       message: ParsedMessage<Argument[key]['argument']>,
//     ) => Argument[key]['return'] | Promise<Argument[key]['return']>;
//   }[keyof Argument];

export type BasePublishFunctions<
  Argument extends BaseArgument,
  > = {
    [key in keyof Argument]: (
      message: Argument[key]['argument'],
      routingKey?: string,
    ) => void;
  };

// type BaseSenderReceiver<
//   QueueName extends KeyOf = KeyOf,
//   Argument extends BaseArgument = BaseArgument,
//   > = {
//     queueName: QueueName;
//     // argKeys: keyof Argument;
//     send: ParamIntersection<BaseSendFunctions<Argument>>;
//     // sendRPC: BaseSendRPCFunction<Argument>;
//     consume: BaseConsumeFunction<Argument>;
//     // consume: ParamIntersection<BaseConsumeFunctions<Argument>>; // OLD
//     // consumeRPC: BaseConsumeRPCFunction<Arguments[QueueName]>;
//     // publish: BasePublishFunction<Argument>;
//   };

// export type BaseSendersReceivers<
//   Arguments extends BaseArguments<keyof Arguments>,
//   > = {
//     [key in keyof Arguments]: BaseSenderReceiver<key, Arguments[key]>;
//   };

// export type BaseSendersReceiversRPC<
//   QueueNames extends string = string,
//   Arguments extends BaseArgumentsRPC<QueueNames> = BaseArgumentsRPC<QueueNames>
//   > = {
//     [key in QueueNames]: BaseSenderReceiver<key, Arguments[key]>;
//     // }[QueueNames];
//   };

export interface IQueue<QueueName extends KeyOf, Argument extends BaseArgument> {
  channel: IChannel<{ [key in QueueName]: Argument }>;
  name: QueueName;
  send: ParamIntersection<BaseSendFunctions<Argument>>;
  // sendRPC: T['sendRPC'][keyof T['sendRPC']];
  setConsume: (
    consumeFunction: (message: amqp.Message | null) => ReturnType<BaseConsumeFunction<Argument>>,
    options?: amqp.Options.Consume,
  ) => Promise<void>;
  // setConsumeRPC: (
  //   consumeFunction: (message: amqp.Message | null) => ReturnType<T['consumeRPC']>,
  //   options?: amqp.Options.Consume,
  // ) => Promise<void>;
}

export interface IExchange<QueueName extends KeyOf, Argument extends BaseArgument> {
  channel: IChannel<{ [key in QueueName]: Argument }>;
  name: QueueName;
  publish: ParamIntersection<BasePublishFunctions<Argument>>;
}

export interface IChannel<
  Arguments extends BaseArguments<keyof Arguments>,
  > {
  channel: amqp.Channel;
  queues: Queues;
  exchanges: Exchanges;
  close: () => Promise<void>;
  createSender: IChannel<Arguments>['assertQueue'];
  createPublisher: IChannel<Arguments>['asserExchange'];

  createReceiver: ParamIntersection<{
    [key in keyof Arguments]: (
      queueName: key,
      consumeFunction: BaseConsumeFunction<Arguments[key]>,
      prefetch?: number,
      assertOptions?: amqp.Options.AssertQueue,
      consumeOptions?: amqp.Options.Consume,
    ) => Promise<IQueue<key, Arguments[key]>>;
  }>;
  createSubscriber: ParamIntersection<{
    [key in keyof Arguments]: (
      exchangeName: key,
      exchangeType: ExchangeTypes,
      consumeFunction: BaseConsumeFunction<Arguments[key]>,
      patterns?: string[],
      exchangeOptions?: amqp.Options.AssertExchange,
      queueOptions?: amqp.Options.AssertQueue,
      consumeOptions?: amqp.Options.Consume,
    ) => Promise<[IExchange<key, Arguments[key]>, IQueue<key, Arguments[key]>]>;
  }>

  assertQueue: <U extends keyof Arguments>(
    queueName: U,
    options?: amqp.Options.AssertQueue,
  ) => Promise<IQueue<U, Arguments[U]>>;
  asserExchange: <U extends keyof Arguments>(
    exchangeName: U,
    exchangeType: ExchangeTypes,
    options?: amqp.Options.AssertExchange,
  ) => Promise<IExchange<U, Arguments[U]>>;
  bindQueue: <U extends keyof Arguments>(
    queueName: string,
    exchangeName: U,
    pattern: string,
    args?: any,
  ) => Promise<void>;
  consumeQueue: <QueueName extends keyof Arguments>(
    queueName: QueueName,
    consumeFunction: (
      message: amqp.Message | null,
    ) => ReturnType<BaseConsumeFunction<Arguments[QueueName]>>,
    options?: amqp.Options.Consume,
  ) => Promise<void>;
  sendToQueue: <QueueName extends keyof Arguments>(
    queueName: QueueName,
    message: SendToQueueMessage, // TODO: Better type?
    options?: amqp.Options.Publish,
    checkQueue?: boolean,
  ) => void;
  publish: <U extends keyof Arguments>(
    exchangeName: U,
    message: SendToQueueMessage,
    routingKey: string,
  ) => void;
}

// const isPromise = (value: any) => {
//   if (typeof value === 'object' && typeof value.then === 'function') {
//     return true;
//   }

//   return false;
// }

const toParsedMessage = <T>(message: amqp.Message): ParsedMessage<T> => ({
  ...message,
  content: JSON.parse(message.content.toString()),
});

// type ToParsedMessageConsumer = <T extends BaseSenderReceiver>(consumeFunction: T['consume']) => (message: amqp.Message | null) => ReturnType<typeof consumeFunction>;
// const toParsedMessageConsumer: ToParsedMessageConsumer = <T extends BaseSenderReceiver>(
//   consumeFunction: T['consume'],
// ) => (
//   message,
//   ) => {
//     if (message == null) {
//       throw new Error('null message');
//     }
//     return consumeFunction(toParsedMessage(message)) as ReturnType<T['consume']>;
//   };

// class Queue<T extends BaseSenderReceiver> implements IQueue<T> {
//   declare channel;

//   declare name;

//   constructor(channel: IChannel, queue: amqp.Replies.AssertQueue) {
//     this.channel = channel;
//     this.name = queue.queue;
//   }

//   send: IQueue<T>['send'] = (message) => {
//     this.channel.sendToQueue(this.name, message);
//   };

// sendRPC: IQueue<T>['sendRPC'] = (message) => new Promise<any>((resolve) => {
//   this.channel.assertQueue('', { exclusive: true })
//     .then((queue) => {
//       const uuid = uuidV4();

//       queue.setConsume((msg) => {
//         if (msg?.properties.correlationId === uuid) {
//           resolve(JSON.parse(msg.content.toString()));
//         }
//       }, { noAck: true });
//       this.channel.sendToQueue(this.name, message, {
//         correlationId: uuid,
//         replyTo: queue.name,
//       });
//     });
// });

// setConsume: IQueue<T>['setConsume'] = (
//   consumeFunction,
//   options?,
// ) => this.channel.consumeQueue(this.name, consumeFunction, options);

// setConsumeRPC: IQueue<T>['setConsumeRPC'] = (
//   consumeFunction,
//   options?,
// ) => this.channel.consumeQueue(this.name, consumeFunction, options);
// }

// class Exchange<T extends BaseSenderReceiver> implements IExchange<T> {
//   declare channel;

//   declare name;

//   constructor(channel: IChannel, exchange: amqp.Replies.AssertExchange) {
//     this.channel = channel;
//     this.name = exchange.exchange;
//   }

//   publish: IExchange<T>['publish'] = (message, routingKey = '') => {
//     this.channel.publish(this.name, message, routingKey);
//   };
// }

// class Channel<T extends BaseSendersReceivers> implements IChannel<T> {
//   declare channel;

//   declare queues: IChannel<T>['queues'];

//   // declare exchanges: IChannel<T>['exchanges'];

//   constructor(channel: IChannel<T>['channel']) {
//     this.channel = channel;
//     this.queues = {};
//     // this.exchanges = {};
//   }

//   private isExistingQueue = (queueName: string) => (queueName in this.queues);

//   // private isExistingExchange = (exchangeName: string) => (exchangeName in this.exchanges);

//   private checkQueueAlreadyExists = (queueName: string) => {
//     if (this.isExistingQueue(queueName)) {
//       throw new Error(RABBITMQ.QUEUE_ALREADY_EXISTS);
//     }
//   };

//   private checkQueueNotExists = (queueName: string) => {
//     if (!this.isExistingQueue(queueName)) {
//       throw new Error(RABBITMQ.QUEUE_NOT_EXISTS);
//     }
//   };

//   // private checkExchangeAlreadyExists = (exchangeName: string) => {
//   //   if (this.isExistingExchange(exchangeName)) {
//   //     throw new Error(RABBITMQ.EXCHANGE_ALREADY_EXISTS);
//   //   }
//   // };

//   // private checkExchangeNotExists = (exchangeName: string) => {
//   //   if (!this.isExistingExchange(exchangeName)) {
//   //     throw new Error(RABBITMQ.EXCHANGE_NOT_EXISTS);
//   //   }
//   // };

//   close: IChannel<T>['close'] = () => new Promise((resolve) => {
//     this.channel.close((error) => {
//       if (error) throw error;

//       resolve();
//     });
//   });

//   assertQueue: IChannel<T>['assertQueue'] = (
//     queueName,
//     options?,
//   ) => new Promise((resolve) => {
//     const strQueueName = queueName.toString();

//     this.checkQueueAlreadyExists(strQueueName);

//     this.channel.assertQueue(strQueueName, options, (error, queue) => {
//       if (error) throw error;

//       const queueClass = new Queue<T[typeof queueName]>(this as unknown as IChannel, queue);

//       this.queues[queueClass.name] = queueClass;
//       resolve(queueClass);
//     });
//   });

//   // asserExchange: IChannel<T>['asserExchange'] = (
//   //   exchangeName,
//   //   exchangeType,
//   //   options?,
//   // ) => new Promise((resolve) => {
//   //   const strExchangeName = exchangeName.toString();

//   //   this.checkExchangeAlreadyExists(strExchangeName);

//   //   this.channel.assertExchange(strExchangeName, exchangeType, options, (error, exchange) => {
//   //     if (error) throw error;

//   //     const exchangeClass = new Exchange<T[typeof exchangeName]>(this as unknown as IChannel, exchange);
//   //     this.exchanges[exchangeClass.name] = exchangeClass;
//   //     resolve(exchangeClass);
//   //   });
//   // });

//   // bindQueue: IChannel<T>['bindQueue'] = (
//   //   queueName,
//   //   exchangeName,
//   //   pattern = '',
//   //   args?,
//   // ) => new Promise((resolve) => {
//   //   const strExchangeName = exchangeName.toString();

//   //   this.checkQueueNotExists(queueName);
//   //   this.checkExchangeNotExists(strExchangeName);

//   //   this.channel.bindQueue(
//   //     this.queues[queueName].name,
//   //     strExchangeName,
//   //     pattern,
//   //     args,
//   //     (error) => {
//   //       if (error) throw error;

//   //       resolve();
//   //     },
//   //   );
//   // });

//   consumeQueue: IChannel<T>['consumeQueue'] = (
//     queueName,
//     consumeFunction,
//     options?,
//   ) => new Promise((resolve) => {
//     const strQueueName = queueName.toString();

//     this.checkQueueNotExists(strQueueName);

//     this.channel.consume(
//       this.queues[strQueueName].name,
//       consumeFunction,
//       options,
//       (error) => {
//         if (error) throw error;

//         resolve();
//       },
//     );
//   });

//   sendToQueue: IChannel<T>['sendToQueue'] = (
//     queueName,
//     message,
//     options?,
//     checkQueues?,
//   ) => {
//     const strQueueName = queueName.toString();

//     if (checkQueues === true) {
//       this.checkQueueNotExists(strQueueName);
//     }

//     this.channel.sendToQueue(
//       strQueueName,
//       Buffer.from(JSON.stringify(message)),
//       options,
//     );
//   };

//   // publish: IChannel<T>['publish'] = (
//   //   exchangeName,
//   //   message,
//   //   routingKey = '',
//   // ) => {
//   //   const strExchangeName = exchangeName.toString()

//   //   this.checkExchangeNotExists(strExchangeName);

//   //   this.channel.publish(
//   //     strExchangeName,
//   //     routingKey,
//   //     Buffer.from(JSON.stringify(message)),
//   //   );
//   // };
// }

let connection: amqp.Connection | null = null;

export default class RabbitMQClient {
  static isConnected = () => connection != null;

  static isDisconnected = () => connection == null;

  static connect = (
    hostname?: string,
    options: amqp.Options.Connect = {},
  ) => new Promise<void>((resolve, reject) => {
    const host = hostname || process.env.RABBITMQ_HOST || 'localhost';
    const timer = setTimeout(() => { reject(new Error('timeout')); }, 2000);
    amqp.connect(
      `amqp://${host}`,
      options,
      (error, conn) => {
        clearTimeout(timer);
        if (error) reject(error);

        connection = conn;
        resolve();
      },
    );
  });

  static close = () => new Promise<void>((resolve) => {
    if (this.isDisconnected()) throw new Error(RABBITMQ.NOT_CONNECTED);

    connection?.close((error) => {
      if (error) throw error;

      connection = null;
      resolve();
    });
  });

  private static privateCreateChannel = <T extends BaseArguments<keyof T>>() => new Promise<IChannel<T>>((resolve) => {
    connection?.createChannel((error, channel) => {
      if (error) throw error;

      resolve(new Channel<T>(channel));
    });
  });

  static createChannel = async <T extends BaseArguments<keyof T>>(): Promise<IChannel<T>> => {
    if (this.isDisconnected()) {
      await this.connect();
    }
    return this.privateCreateChannel<T>();
  };

  // static createSender = async <T extends BaseSendersReceivers, Q extends keyof T>(
  //   queueName: Q,
  //   channel?: IChannel<T>,
  //   options: amqp.Options.AssertQueue = {},
  // ) => {
  //   const currentChannel = channel != null ? channel : await this.createChannel<T>();
  //   const queue = await currentChannel.assertQueue(queueName, { durable: false, ...options });

  //   return {
  //     channel: currentChannel,
  //     queue,
  //     name: queue.name,
  //   };
  // };

  // static createPublisher = async <T extends BaseSendersReceivers>(
  //   exchangeName: T[keyof T]['queueName'],
  //   exchangeType: ExchangeTypes,
  //   channel?: IChannel<T>,
  //   options: amqp.Options.AssertExchange = {},
  // ) => {
  //   const currentChannel = channel != null
  //     ? channel
  //     : await this.createChannel<T>();
  //   const exchange = await currentChannel.asserExchange(
  //     exchangeName,
  //     exchangeType,
  //     {
  //       durable: false,
  //       ...options,
  //     },
  //   );

  //   return {
  //     channel: currentChannel,
  //     exchange,
  //     name: exchange.name,
  //   };
  // };

  // static createReceiver = async <T extends BaseSendersReceivers, Q extends keyof T>(
  //   queueName: Q,
  //   consumeFunction: T[Q]['consume'],
  //   prefetch?: number,
  //   channel?: IChannel<T>,
  //   assertOptions: amqp.Options.AssertQueue = {},
  //   consumeOptions: amqp.Options.Consume = {},
  // ) => {
  //   const currentChannel = channel != null ? channel : await this.createChannel<T>();
  //   const queue = await currentChannel.assertQueue(
  //     queueName,
  //     { durable: false, ...assertOptions },
  //   );

  //   if (prefetch != null) {
  //     currentChannel.channel.prefetch(1);
  //   }
  //   await queue.setConsume(
  //     toParsedMessageConsumer(consumeFunction),
  //     { noAck: true, ...consumeOptions },
  //   );
  //   return {
  //     channel: currentChannel,
  //     queue,
  //     name: queue.name,
  //   };
  // };

  // static createReceiverRPC = async <T extends BaseSendersReceivers>(
  //   queueName: T[keyof T]['queueName'],
  //   consumeFunction: T[typeof queueName]['consumeRPC'],
  //   prefetch?: number,
  //   channel?: IChannel<T>,
  //   assertOptions: amqp.Options.AssertQueue = {},
  //   consumeOptions: amqp.Options.Consume = {},
  //   sendResponseOptions: amqp.Options.Publish = {},
  // ) => {
  //   const currentChannel = channel != null ? channel : await this.createChannel<T>();

  //   return this.createReceiver(
  //     queueName,
  //     async (message) => {
  //       if (message?.properties.replyTo != null) {
  //         const consumeReturn = consumeFunction(message);

  //         currentChannel.sendToQueue(
  //           message.properties.replyTo,
  //           isPromise(consumeReturn) ? await consumeReturn : consumeReturn,
  //           {
  //             correlationId: message.properties.correlationId,
  //             ...sendResponseOptions,
  //           },
  //         );
  //       }
  //     },
  //     prefetch,
  //     currentChannel,
  //     assertOptions,
  //     consumeOptions,
  //   );
  // };

  // static createSubscriber = async <T extends BaseSendersReceivers>(
  //   exchangeName: T[keyof T]['queueName'],
  //   exchangeType: ExchangeTypes,
  //   consumeFunction: T[typeof exchangeName]['consume'],
  //   patterns: string[] = [''],
  //   channel?: IChannel<T>,
  //   exchangeOptions: amqp.Options.AssertExchange = {},
  //   queueOptions: amqp.Options.AssertQueue = {},
  //   consumeOptions: amqp.Options.Consume = {},
  // ) => {
  //   const currentChannel = channel != null ? channel : await this.createChannel<T>();
  //   const exchange = await currentChannel.asserExchange(
  //     exchangeName,
  //     exchangeType,
  //     { durable: false, ...exchangeOptions },
  //   );
  //   const queue = await currentChannel.assertQueue(
  //     '',
  //     { exclusive: true, ...queueOptions },
  //   );

  //   await Promise.all(
  //     patterns.map(
  //       (pattern) => currentChannel.bindQueue(
  //         queue.name,
  //         exchange.name,
  //         pattern,
  //       ),
  //     ),
  //   );
  //   await queue.setConsume(
  //     toParsedMessageConsumer(consumeFunction),
  //     { noAck: true, ...consumeOptions },
  //   );
  //   return {
  //     channel: currentChannel,
  //     exchange,
  //     queue,
  //     name: exchange.name,
  //   };
  // };
}
