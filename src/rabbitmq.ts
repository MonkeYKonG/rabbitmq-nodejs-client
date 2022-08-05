/* eslint-disable max-len */
/* eslint-disable max-classes-per-file */
import * as dotenv from 'dotenv';
import amqp from 'amqplib/callback_api';
import { v4 as uuidV4 } from 'uuid';

import { RABBITMQ } from './errors';

dotenv.config();

type KeyOf = string | number | symbol;

export type BaseArgument<Keys extends KeyOf = KeyOf> = {
  [k in Keys]: {
    argument: any;
    return: void;
  } };
type BaseArgumentRPC = Record<any, {
  argument: any;
  return: any;
}>;

type BaseQueueName = string;
// export type BaseArguments<
//   T extends BaseQueueName,
//   U extends { [key in T]: string } = { [key in T]: string }
//   > = {
//     [key in T]: BaseArgument<U[key]>
//   };
export type BaseArguments<
  T extends BaseQueueName,
  U extends { [key in T]: string } = { [key in T]: string }
  > = {
    [key in T]: {
      [k in U[key]]: {
        argument: any;
        return: void;
      }
    }
  };
type BaseArgumentsRPC<T extends BaseQueueName> = Record<T, BaseArgumentRPC>;

type SendToQueueMessage = any;

type Queues = Record<string, IQueue<any>>;

type ExchangeTypes = 'fanout' | 'direct' | 'topic' | 'header';
type Exchanges = Record<string, IExchange<any>>;

type ParsedMessage<T> = Omit<amqp.Message, 'content'> & {
  content: T
};

export type BaseSendFunction<
  Argument extends BaseArgument<string>,
  > = {
    [key in keyof Argument]: (
      message: Argument[key]['argument'],
    ) => void;
  }[keyof Argument];

export type BaseSendRPCFunction<
  Argument extends BaseArgumentRPC,
  > = {
    [key in keyof Argument]: (
      message: Argument[key]['argument'],
    ) => Promise<Argument[key]['return']>;
  }[keyof Argument];

export type BaseConsumeFunction<
  Argument extends BaseArgument,
  > = {
    [key in keyof Argument]: (
      message: ParsedMessage<Argument[key]['argument']>,
    ) => void | Promise<void>;
  }[keyof Argument];

export type BaseConsumeRPCFunction<
  Argument extends BaseArgumentRPC,
  > = {
    [key in keyof Argument]: (
      message: ParsedMessage<Argument[key]['argument']>,
    ) => Argument[key]['return'] | Promise<Argument[key]['return']>;
  }[keyof Argument];

export type BasePublishFunction<
  Argument extends BaseArgument,
  > = {
    [key in keyof Argument]: (
      message: Argument[key]['argument'],
      routingKey?: string,
    ) => void;
  }[keyof Argument]

type BaseSenderReceiver<
  QueueName extends string = string,
  Keys extends KeyOf = string,
  Argument extends BaseArgument<Keys> = BaseArgument<Keys>,
  > = {
    queueName: QueueName,
    send: BaseSendFunction<Argument>;
    sendRPC: BaseSendRPCFunction<Argument>;
    consume: BaseConsumeFunction<Argument>;
    consumeRPC: BaseConsumeRPCFunction<Argument>;
    publish: BasePublishFunction<Argument>;
  };

export type BaseSendersReceivers<
  QueueNames extends string = string,
  Arguments extends BaseArguments<QueueNames> = BaseArguments<QueueNames>,
  > = {
    [key in keyof Arguments]: BaseSenderReceiver<key, keyof Arguments[key], Arguments[key]>;
  };

export type BaseSendersReceiversRPC<
  QueueNames extends string = string,
  Arguments extends BaseArgumentsRPC<QueueNames> = BaseArgumentsRPC<QueueNames>
  > = {
    [key in QueueNames]: BaseSenderReceiver<key, Arguments>;
    // }[QueueNames];
  };

export interface IQueue<T extends BaseSenderReceiver = BaseSenderReceiver> {
  channel: IChannel;
  name: T['queueName'];
  send: T['send'];
  sendRPC: T['sendRPC'];
  setConsume: (
    consumeFunction: (message: amqp.Message | null) => ReturnType<T['consume']>, // Possible to have the same with ReturnType<T['consume']>
    options?: amqp.Options.Consume,
  ) => Promise<void>;
  setConsumeRPC: (
    consumeFunction: (message: amqp.Message | null) => ReturnType<T['consumeRPC']>,
    options?: amqp.Options.Consume,
  ) => Promise<void>;
}

export interface IExchange<T extends BaseSenderReceiver> {
  channel: IChannel;
  name: T['queueName'];
  publish: T['publish'];
}

export interface IChannel<T extends BaseSendersReceivers = BaseSendersReceivers> {
  channel: amqp.Channel;
  queues: Queues;
  exchanges: Exchanges;
  close: () => Promise<void>;
  assertQueue: <U extends keyof T>(
    queueName: U,
    options?: amqp.Options.AssertQueue,
  ) => Promise<IQueue<T[U]>>;
  asserExchange: <U extends keyof T>(
    exchangeName: U,
    exchangeType: ExchangeTypes,
    options?: amqp.Options.AssertExchange,
  ) => Promise<IExchange<T[U]>>;
  bindQueue: <U extends keyof T>(
    queueName: string,
    exchangeName: U,
    pattern: string,
    args?: any,
  ) => Promise<void>;
  consumeQueue: <U extends keyof T>(
    queueName: U,
    consumeFunction: (message: amqp.Message | null) => ReturnType<T[U]['consume']>,
    options?: amqp.Options.Consume,
  ) => Promise<void>;
  sendToQueue: <U extends keyof T>(
    queueName: U,
    message: SendToQueueMessage,
    options?: amqp.Options.Publish,
    checkQueue?: boolean,
  ) => void;
  publish: <U extends keyof T>(
    exchangeName: U,
    message: SendToQueueMessage,
    routingKey: string,
  ) => void;
}

const isPromise = (value: any) => {
  if (typeof value === 'object' && typeof value.then === 'function') {
    return true;
  }

  return false;
}

const toParsedMessage = <T>(message: amqp.Message): ParsedMessage<T> => ({
  ...message,
  content: JSON.parse(message.content.toString()),
});

type ToParsedMessageConsumer = <T extends BaseSenderReceiver>(consumeFunction: T['consume']) => (message: amqp.Message | null) => ReturnType<typeof consumeFunction>;
const toParsedMessageConsumer: ToParsedMessageConsumer = <T extends BaseSenderReceiver>(
  consumeFunction: T['consume'],
) => (
  message,
  ) => {
    if (message == null) {
      throw new Error('null message');
    }
    return consumeFunction(toParsedMessage(message)) as ReturnType<T['consume']>;
  };

class Queue<T extends BaseSenderReceiver> implements IQueue<T> {
  declare channel;

  declare name;

  constructor(channel: IChannel, queue: amqp.Replies.AssertQueue) {
    this.channel = channel;
    this.name = queue.queue;
  }

  send: IQueue<T>['send'] = (message) => {
    this.channel.sendToQueue(this.name, message);
  };

  sendRPC: IQueue<T>['sendRPC'] = (message) => new Promise<any>((resolve) => {
    this.channel.assertQueue('', { exclusive: true })
      .then((queue) => {
        const uuid = uuidV4();

        queue.setConsume((msg) => {
          if (msg?.properties.correlationId === uuid) {
            resolve(JSON.parse(msg.content.toString()));
          }
        }, { noAck: true });
        this.channel.sendToQueue(this.name, message, {
          correlationId: uuid,
          replyTo: queue.name,
        });
      });
  });

  setConsume: IQueue<T>['setConsume'] = (
    consumeFunction,
    options?,
  ) => this.channel.consumeQueue(this.name, consumeFunction, options);

  setConsumeRPC: IQueue<T>['setConsumeRPC'] = (
    consumeFunction,
    options?,
  ) => this.channel.consumeQueue(this.name, consumeFunction, options);
}

class Exchange<T extends BaseSenderReceiver> implements IExchange<T> {
  declare channel;

  declare name;

  constructor(channel: IChannel, exchange: amqp.Replies.AssertExchange) {
    this.channel = channel;
    this.name = exchange.exchange;
  }

  publish: IExchange<T>['publish'] = (message, routingKey = '') => {
    this.channel.publish(this.name, message, routingKey);
  };
}

class Channel<T extends BaseSendersReceivers> implements IChannel<T> {
  declare channel;

  declare queues: IChannel<T>['queues'];

  declare exchanges: IChannel<T>['exchanges'];

  constructor(channel: IChannel<T>['channel']) {
    this.channel = channel;
    this.queues = {};
    this.exchanges = {};
  }

  private isExistingQueue = (queueName: string) => (queueName in this.queues);

  private isExistingExchange = (exchangeName: string) => (exchangeName in this.exchanges);

  private checkQueueAlreadyExists = (queueName: string) => {
    if (this.isExistingQueue(queueName)) {
      throw new Error(RABBITMQ.QUEUE_ALREADY_EXISTS);
    }
  };

  private checkQueueNotExists = (queueName: string) => {
    if (!this.isExistingQueue(queueName)) {
      throw new Error(RABBITMQ.QUEUE_NOT_EXISTS);
    }
  };

  private checkExchangeAlreadyExists = (exchangeName: string) => {
    if (this.isExistingExchange(exchangeName)) {
      throw new Error(RABBITMQ.EXCHANGE_ALREADY_EXISTS);
    }
  };

  private checkExchangeNotExists = (exchangeName: string) => {
    if (!this.isExistingExchange(exchangeName)) {
      throw new Error(RABBITMQ.EXCHANGE_NOT_EXISTS);
    }
  };

  close: IChannel<T>['close'] = () => new Promise((resolve) => {
    this.channel.close((error) => {
      if (error) throw error;

      resolve();
    });
  });

  assertQueue: IChannel<T>['assertQueue'] = (
    queueName,
    options?,
  ) => new Promise((resolve) => {
    const strQueueName = queueName.toString();

    this.checkQueueAlreadyExists(strQueueName);

    this.channel.assertQueue(strQueueName, options, (error, queue) => {
      if (error) throw error;

      const queueClass = new Queue<T[typeof queueName]>(this as unknown as IChannel, queue);

      this.queues[queueClass.name] = queueClass;
      resolve(queueClass);
    });
  });

  asserExchange: IChannel<T>['asserExchange'] = (
    exchangeName,
    exchangeType,
    options?,
  ) => new Promise((resolve) => {
    const strExchangeName = exchangeName.toString();

    this.checkExchangeAlreadyExists(strExchangeName);

    this.channel.assertExchange(strExchangeName, exchangeType, options, (error, exchange) => {
      if (error) throw error;

      const exchangeClass = new Exchange<T[typeof exchangeName]>(this as unknown as IChannel, exchange);
      this.exchanges[exchangeClass.name] = exchangeClass;
      resolve(exchangeClass);
    });
  });

  bindQueue: IChannel<T>['bindQueue'] = (
    queueName,
    exchangeName,
    pattern = '',
    args?,
  ) => new Promise((resolve) => {
    const strExchangeName = exchangeName.toString();

    this.checkQueueNotExists(queueName);
    this.checkExchangeNotExists(strExchangeName);

    this.channel.bindQueue(
      this.queues[queueName].name,
      strExchangeName,
      pattern,
      args,
      (error) => {
        if (error) throw error;

        resolve();
      },
    );
  });

  consumeQueue: IChannel<T>['consumeQueue'] = (
    queueName,
    consumeFunction,
    options?,
  ) => new Promise((resolve) => {
    const strQueueName = queueName.toString();

    this.checkQueueNotExists(strQueueName);

    this.channel.consume(
      this.queues[strQueueName].name,
      consumeFunction,
      options,
      (error) => {
        if (error) throw error;

        resolve();
      },
    );
  });

  sendToQueue: IChannel<T>['sendToQueue'] = (
    queueName,
    message,
    options?,
    checkQueues?,
  ) => {
    const strQueueName = queueName.toString();

    if (checkQueues === true) {
      this.checkQueueNotExists(strQueueName);
    }

    this.channel.sendToQueue(
      strQueueName,
      Buffer.from(JSON.stringify(message)),
      options,
    );
  };

  publish: IChannel<T>['publish'] = (
    exchangeName,
    message,
    routingKey = '',
  ) => {
    const strExchangeName = exchangeName.toString()

    this.checkExchangeNotExists(strExchangeName);

    this.channel.publish(
      strExchangeName,
      routingKey,
      Buffer.from(JSON.stringify(message)),
    );
  };
}

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

  private static privateCreateChannel = <T extends BaseSendersReceivers>() => new Promise<Channel<T>>((resolve) => {
    connection?.createChannel((error, channel) => {
      if (error) throw error;

      resolve(new Channel<T>(channel));
    });
  });

  static createChannel = async <T extends BaseSendersReceivers>(): Promise<Channel<T>> => {
    if (this.isDisconnected()) {
      await this.connect();
    }
    return this.privateCreateChannel<T>();
  };

  static createSender = async <T extends BaseSendersReceivers>(
    queueName: T[keyof T]['queueName'],
    channel?: IChannel<T>,
    options: amqp.Options.AssertQueue = {},
  ) => {
    const currentChannel = channel != null ? channel : await this.createChannel<T>();
    const queue = await currentChannel.assertQueue(queueName, { durable: false, ...options });

    return {
      channel: currentChannel,
      queue,
      name: queue.name as typeof queueName,
    };
  };

  static createPublisher = async <T extends BaseSendersReceivers>(
    exchangeName: T[keyof T]['queueName'],
    exchangeType: ExchangeTypes,
    channel?: IChannel<T>,
    options: amqp.Options.AssertExchange = {},
  ) => {
    const currentChannel = channel != null
      ? channel
      : await this.createChannel<T>();
    const exchange = await currentChannel.asserExchange(
      exchangeName,
      exchangeType,
      {
        durable: false,
        ...options,
      },
    );

    return {
      channel: currentChannel,
      exchange,
      name: exchange.name,
    };
  };

  static createReceiver = async <T extends BaseSendersReceivers>(
    queueName: keyof T,
    consumeFunction: T[keyof T]['consume'],
    prefetch?: number,
    channel?: IChannel<T>,
    assertOptions: amqp.Options.AssertQueue = {},
    consumeOptions: amqp.Options.Consume = {},
  ) => {
    const currentChannel = channel != null ? channel : await this.createChannel<T>();
    const queue = await currentChannel.assertQueue(
      queueName,
      { durable: false, ...assertOptions },
    );

    if (prefetch != null) {
      currentChannel.channel.prefetch(1);
    }
    await queue.setConsume(
      toParsedMessageConsumer(consumeFunction),
      { noAck: true, ...consumeOptions },
    );
    return {
      channel: currentChannel,
      queue,
      name: queue.name,
    };
  };

  static createReceiverRPC = async <T extends BaseSendersReceivers>(
    queueName: T[keyof T]['queueName'],
    consumeFunction: T[typeof queueName]['consumeRPC'],
    prefetch?: number,
    channel?: IChannel<T>,
    assertOptions: amqp.Options.AssertQueue = {},
    consumeOptions: amqp.Options.Consume = {},
    sendResponseOptions: amqp.Options.Publish = {},
  ) => {
    const currentChannel = channel != null ? channel : await this.createChannel<T>();

    return this.createReceiver(
      queueName,
      async (message) => {
        if (message?.properties.replyTo != null) {
          const consumeReturn = consumeFunction(message);

          currentChannel.sendToQueue(
            message.properties.replyTo,
            isPromise(consumeReturn) ? await consumeReturn : consumeReturn,
            {
              correlationId: message.properties.correlationId,
              ...sendResponseOptions,
            },
          );
        }
      },
      prefetch,
      currentChannel,
      assertOptions,
      consumeOptions,
    );
  };

  static createSubscriber = async <T extends BaseSendersReceivers>(
    exchangeName: T[keyof T]['queueName'],
    exchangeType: ExchangeTypes,
    consumeFunction: T[typeof exchangeName]['consume'],
    patterns: string[] = [''],
    channel?: IChannel<T>,
    exchangeOptions: amqp.Options.AssertExchange = {},
    queueOptions: amqp.Options.AssertQueue = {},
    consumeOptions: amqp.Options.Consume = {},
  ) => {
    const currentChannel = channel != null ? channel : await this.createChannel<T>();
    const exchange = await currentChannel.asserExchange(
      exchangeName,
      exchangeType,
      { durable: false, ...exchangeOptions },
    );
    const queue = await currentChannel.assertQueue(
      '',
      { exclusive: true, ...queueOptions },
    );

    await Promise.all(
      patterns.map(
        (pattern) => currentChannel.bindQueue(
          queue.name,
          exchange.name,
          pattern,
        ),
      ),
    );
    await queue.setConsume(
      toParsedMessageConsumer(consumeFunction),
      { noAck: true, ...consumeOptions },
    );
    return {
      channel: currentChannel,
      exchange,
      queue,
      name: exchange.name,
    };
  };
}
