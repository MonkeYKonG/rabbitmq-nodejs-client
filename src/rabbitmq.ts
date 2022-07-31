/* eslint-disable max-len */
/* eslint-disable max-classes-per-file */
import * as dotenv from 'dotenv';
import amqp from 'amqplib/callback_api';
import { v4 as uuidV4 } from 'uuid';

import { RABBITMQ } from './errors';

dotenv.config();

type BaseQueueName = string;
type BaseArguments<T extends BaseQueueName> = Record<T, any>;
type BaseReturns<T extends BaseQueueName> = Record<T, any>;

type ConsumeFunction<T = void> = (message: amqp.Message | null) => T;
type SendToQueueMessage = any;

type Queues<T extends BaseSenders> = Record<string, IQueue<T[keyof T]>>;

type ExchangeTypes = 'fanout' | 'direct' | 'topic' | 'header';
type Exchanges<T extends BaseSenders> = Record<string, IExchange<T[keyof T]>>;

export type BaseMessageArguments<QueueNames extends string, Arguments extends BaseArguments<QueueNames>> = {
  [key in QueueNames]: Arguments[key];
};

export type BaseMessageReturn<QueueNames extends string, Returns extends BaseReturns<QueueNames>> = {
  [key in QueueNames]: Returns[key];
};

export type BaseSendFunction<QueueNames extends string, Arguments extends BaseArguments<QueueNames>> = {
  [key in QueueNames]: (
    message: BaseMessageArguments<QueueNames, Arguments>[key],
  ) => void;
};

export type BaseSendRPCFunction<QueueNames extends string, Arguments extends BaseArguments<QueueNames>, Returns extends BaseReturns<QueueNames>> = {
  [key in QueueNames]: (
    message: BaseMessageArguments<QueueNames, Arguments>[key],
  ) => Promise<BaseMessageReturn<QueueNames, Returns>[key]> | void;
};

export type BaseConsumeFunction<QueueNames extends string, Arguments extends BaseArguments<QueueNames>> = {
  [key in QueueNames]: (
    message: BaseMessageArguments<QueueNames, Arguments>[key],
  ) => void;
};

export type BaseConsumeRPCFunction<QueueNames extends string, Arguments extends BaseArguments<QueueNames>, Returns extends BaseReturns<QueueNames>> = {
  [key in QueueNames]: (
    message: BaseMessageArguments<QueueNames, Arguments>[key],
  ) => BaseMessageReturn<QueueNames, Returns>[key];
};

export type BasePublishFunction<QueueNames extends string, Arguments extends BaseArguments<QueueNames>> = {
  [key in QueueNames]: (
    message: BaseMessageArguments<QueueNames, Arguments>[key],
    routingKey?: string,
  ) => void;
}

type BaseSender<QueueNames extends string = string, Q extends QueueNames = QueueNames, Arguments extends BaseArguments<QueueNames> = BaseArguments<QueueNames>, Returns extends BaseReturns<QueueNames> = BaseReturns<QueueNames>> = {
  queueName: Q,
  sendRPC: BaseSendRPCFunction<QueueNames, Arguments, Returns>[Q];
  send: BaseSendFunction<QueueNames, Arguments>[Q];
  consume: BaseConsumeFunction<QueueNames, Arguments>[Q];
  publish: BasePublishFunction<QueueNames, Arguments>[Q];
};

export type BaseSenders<QueueNames extends string = string, Arguments extends BaseArguments<QueueNames> = BaseArguments<QueueNames>> = {
  [key in QueueNames]: {
    queueName: key,
    sendRPC: BaseSendFunction<QueueNames, Arguments>[key];
    send: BaseSendFunction<QueueNames, Arguments>[key];
    consume: BaseConsumeFunction<QueueNames, Arguments>[key];
    publish: BasePublishFunction<QueueNames, Arguments>[key];
  }
};

export type BaseSendersRPC<QueueNames extends string = string, Arguments extends BaseArguments<QueueNames> = BaseArguments<QueueNames>, Returns extends BaseReturns<QueueNames> = BaseReturns<QueueNames>> = {
  [key in QueueNames]: {
    queueName: key,
    sendRPC: BaseSendRPCFunction<QueueNames, Arguments, Returns>[key];
    send: BaseSendFunction<QueueNames, Arguments>[key];
    consume: BaseConsumeRPCFunction<QueueNames, Arguments, Returns>[key];
    publish: BasePublishFunction<QueueNames, Arguments>[key];
  }
};

interface IQueue<T extends BaseSender = BaseSender> {
  channel: IChannel;
  name: T['queueName'];
  send: T['send'];
  sendRPC: T['sendRPC'];
  setConsume: (
    consumeFunction: T['consume'],
    options?: amqp.Options.Consume,
  ) => Promise<void>;
}

interface IExchange<T extends BaseSender> {
  channel: IChannel;
  name: T['queueName'];
  publish: T['publish'];
}

interface IChannel<T extends BaseSenders = BaseSenders> {
  channel: amqp.Channel;
  queues: Queues<T>;
  exchanges: Exchanges<T>;
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
  consumeQueue: <U extends keyof T, Return = void>(
    queueName: U,
    consumeFunction: ConsumeFunction<Return>,
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

class Queue<T extends BaseSender> implements IQueue<T> {
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
}

class Exchange<T extends BaseSender> implements IExchange<T> {
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

class Channel<T extends BaseSenders> implements IChannel<T> {
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

  static connect = () => new Promise<void>((resolve) => {
    amqp.connect(`amqp://${process.env.RABBITMQ_HOST}`, (error, conn) => {
      if (error) throw error;

      connection = conn;
      resolve();
    });
  });

  static close = () => new Promise<void>((resolve) => {
    if (this.isDisconnected()) throw new Error(RABBITMQ.NOT_CONNECTED);

    connection?.close((error) => {
      if (error) throw error;

      connection = null;
      resolve();
    });
  });

  private static privateCreateChannel = <T extends BaseSenders>() => new Promise<Channel<T>>((resolve) => {
    connection?.createChannel((error, channel) => {
      if (error) throw error;

      resolve(new Channel<T>(channel));
    });
  });

  static createChannel = async <T extends BaseSenders>(): Promise<Channel<T>> => {
    if (this.isDisconnected()) {
      await this.connect();
    }
    return this.privateCreateChannel<T>();
  };

  static createSender = async<T extends BaseSenders>(
    queueName: keyof T,
    channel?: IChannel<T>,
  ) => {
    const currentChannel = channel != null ? channel : await this.createChannel<T>();
    const queue = await currentChannel.assertQueue(queueName, { durable: false });

    return {
      channel: currentChannel,
      queue,
      name: queue.name as typeof queueName,
    };
  };

  static createPublisher = async <T extends BaseSenders>(
    exchangeName: keyof T,
    exchangeType: ExchangeTypes,
    channel?: IChannel<T>,
  ) => {
    const currentChannel = channel != null
      ? channel
      : await this.createChannel<T>();
    const exchange = await currentChannel.asserExchange(
      exchangeName,
      exchangeType,
      {
        durable: false,
      },
    );

    return {
      channel: currentChannel,
      exchange,
      name: exchange.name,
    };
  };

  static createReceiver = async <T extends BaseSenders>(
    queueName: keyof T,
    consumeFunction: ConsumeFunction,
    prefetch?: number,
    channel?: IChannel<T>,
  ) => {
    const currentChannel = channel != null ? channel : await this.createChannel<T>();
    const queue = await currentChannel.assertQueue(queueName, { durable: false });

    if (prefetch != null) {
      currentChannel.channel.prefetch(1);
    }
    await queue.setConsume(consumeFunction, { noAck: true });
    return {
      channel: currentChannel,
      queue,
      name: queue.name,
    };
  };

  static createReceiverRPC = async <T extends BaseSenders>(
    queueName: keyof T,
    consumeFunction: ConsumeFunction<SendToQueueMessage>,
    prefetch?: number,
    channel?: IChannel<T>,
  ) => {
    const currentChannel = channel != null ? channel : await this.createChannel<T>();

    return this.createReceiver(
      queueName,
      (message) => {
        if (message?.properties.replyTo != null) {
          currentChannel.sendToQueue(
            message.properties.replyTo,
            consumeFunction(message),
            {
              correlationId: message.properties.correlationId,
            },
          );
        }
      },
      prefetch,
      currentChannel,
    );
  };

  static createReceiverRPCJson = <T extends BaseSendersRPC>(
    queueName: keyof T,
    consumeFunction: T[typeof queueName]['consume'],
    prefetch?: number,
    channel?: IChannel<T>,
  ) => this.createReceiverRPC<T>(
    queueName,
    (msg) => consumeFunction(JSON.parse(msg?.content.toString() || '')),
    prefetch,
    channel,
  );

  static createSubscriber = async <T extends BaseSenders>(
    exchangeName: keyof T,
    exchangeType: ExchangeTypes,
    consumeFunction: ConsumeFunction,
    patterns: string[] = [''],
    channel?: IChannel<T>,
  ) => {
    const currentChannel = channel != null ? channel : await this.createChannel<T>();
    const exchange = await currentChannel.asserExchange(
      exchangeName.toString(),
      exchangeType,
      { durable: false },
    );
    const queue = await currentChannel.assertQueue('', { exclusive: true });

    await Promise.all(
      patterns.map(
        (pattern) => currentChannel.bindQueue(
          queue.name,
          exchange.name,
          pattern,
        ),
      ),
    );
    await queue.setConsume(consumeFunction, { noAck: true });
    return {
      channel: currentChannel,
      exchange,
      queue,
      name: exchange.name,
    };
  };
}
