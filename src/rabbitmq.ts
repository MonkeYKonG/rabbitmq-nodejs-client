/* eslint-disable max-len */
/* eslint-disable max-classes-per-file */
import * as dotenv from 'dotenv';
import amqp from 'amqplib/callback_api';
import { v4 as uuidV4 } from 'uuid';

import { RABBITMQ } from './errors';

dotenv.config();

type FunctionsIntersection<T extends Record<any, (...args: any) => any>> = {
  [K in keyof T]: (x: T[K]) => any
}[keyof T] extends
  (x: infer I) => any ? I : never;

type KeyOf = string | number | symbol;

interface BaseArgumentBody<Args extends any = any, Return extends any = any> {
  argument: Args;
  return: Return;
}
type BaseArgument<Keys extends number = number> = {
  [k in Keys]: BaseArgumentBody<any, any>;
}
type BaseArgumentRPC<Keys extends number = number> = {
  [k in Keys]: BaseArgumentBody<any, any>;
};

type BaseArguments<
  T extends KeyOf,
  U extends { [key in T]: number } = { [key in T]: number }
  > = {
    [key in T]: BaseArgument<U[key]>
  };

type SendToQueueMessage = any;

type Queues = Record<any, IQueue<any, any>>;

type ExchangeTypes = 'fanout' | 'direct' | 'topic' | 'header';
type Exchanges = Record<any, IExchange<any, any>>;

type ParsedMessage<T> = Omit<amqp.Message, 'content'> & {
  content: T
};

type BaseSendFunction<T extends BaseArgumentBody> = (
  message: T['argument'],
) => void;
type BaseSendFunctions<
  Argument extends BaseArgument,
  > = {
    [key in keyof Argument]: BaseSendFunction<Argument[key]>;
  };

type BaseSendRPCFunction<T extends BaseArgumentBody> = (
  message: T['argument'],
) => Promise<T['return']>;
type BaseSendRPCFunctions<
  Argument extends BaseArgumentRPC,
  > = {
    [key in keyof Argument]: BaseSendRPCFunction<Argument[key]>;
  };

type BaseConsumeFunction<
  Argument extends BaseArgument,
  > = (
    message: ParsedMessage<Argument[keyof Argument]['argument']>,
  ) => Argument[keyof Argument]['return'] | Promise<Argument[keyof Argument]['return']>;

type BasePublishFunctions<
  Argument extends BaseArgument,
  > = {
    [key in keyof Argument]: (
      message: Argument[key]['argument'],
      routingKey?: string,
    ) => void;
  };

interface IQueue<QueueName extends KeyOf, Argument extends BaseArgument> {
  channel: IChannel<{ [key in QueueName]: Argument }>;
  name: QueueName;
  send: FunctionsIntersection<BaseSendFunctions<Argument>>;
  sendRPC: FunctionsIntersection<BaseSendRPCFunctions<Argument>>;
  setConsume: (
    consumeFunction: (message: amqp.Message | null) => ReturnType<BaseConsumeFunction<Argument>>,
    options?: amqp.Options.Consume,
  ) => Promise<void>;
}

interface IExchange<QueueName extends KeyOf, Argument extends BaseArgument> {
  channel: IChannel<{ [key in QueueName]: Argument }>;
  name: QueueName;
  publish: FunctionsIntersection<BasePublishFunctions<Argument>>;
}

interface IChannel<
  Arguments extends BaseArguments<keyof Arguments>,
  > {
  channel: amqp.Channel;
  queues: Queues;
  exchanges: Exchanges;
  close: () => Promise<void>;
  createSender: IChannel<Arguments>['assertQueue'];
  createPublisher: IChannel<Arguments>['asserExchange'];

  createReceiver: FunctionsIntersection<{
    [key in keyof Arguments]: (
      queueName: key,
      consumeFunction: BaseConsumeFunction<Arguments[key]>,
      prefetch?: number,
      assertOptions?: amqp.Options.AssertQueue,
      consumeOptions?: amqp.Options.Consume,
    ) => Promise<IQueue<key, Arguments[key]>>;
  }>;
  createReceiverRPC: FunctionsIntersection<{
    [key in keyof Arguments]: (
      queueName: key,
      consumeFunction: BaseConsumeFunction<Arguments[key]>,
      prefetch?: number,
      assertOptions?: amqp.Options.AssertQueue,
      consumeOptions?: amqp.Options.Consume,
      sendResponseOptions?: amqp.Options.Publish,
    ) => Promise<IQueue<key, Arguments[key]>>;
  }>;
  createSubscriber: FunctionsIntersection<{
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

type ToParsedMessageConsumer = <T extends BaseArgument>(
  consumeFunction: BaseConsumeFunction<T>,
) => (
    message: amqp.Message | null,
  ) => ReturnType<typeof consumeFunction>;
const toParsedMessageConsumer: ToParsedMessageConsumer = (
  consumeFunction,
) => (
  message,
  ) => {
    if (message == null) {
      throw new Error('null message');
    }
    return consumeFunction(toParsedMessage(message));
  };

class Queue<
  QueueName extends KeyOf,
  Argument extends BaseArgument,
  > implements IQueue<QueueName, Argument> {
  declare channel;

  declare name;

  constructor(
    channel: IChannel<{ [key in QueueName]: Argument }>,
    queue: amqp.Replies.AssertQueue,
  ) {
    this.channel = channel;
    this.name = queue.queue as QueueName;
  }

  send: IQueue<QueueName, Argument>['send'] = ((
    message: any,
  ) => {
    this.channel.sendToQueue(this.name, message);
  }) as IQueue<QueueName, Argument>['send'];

  sendRPC: IQueue<QueueName, Argument>['sendRPC'] = ((
    message: any,
  ) => new Promise<any>((resolve) => {
    this.channel.assertQueue('' as QueueName, { exclusive: true })
      .then((queue) => {
        const uuid = uuidV4();

        queue.setConsume((msg) => {
          if (msg?.properties.correlationId === uuid) {
            resolve(JSON.parse(msg.content.toString()));
          }
        }, { noAck: true });
        this.channel.sendToQueue(this.name, message, {
          correlationId: uuid,
          replyTo: queue.name.toString(),
        });
      });
  })) as IQueue<QueueName, Argument>['sendRPC'];

  setConsume: IQueue<QueueName, Argument>['setConsume'] = (
    consumeFunction,
    options?,
  ) => this.channel.consumeQueue(this.name, consumeFunction, options);
}

class Exchange<
  QueueName extends KeyOf,
  Argument extends BaseArgument,
  > implements IExchange<QueueName, Argument> {
  declare channel;

  declare name;

  constructor(
    channel: IChannel<{ [key in QueueName]: Argument }>,
    exchange: amqp.Replies.AssertExchange,
  ) {
    this.channel = channel;
    this.name = exchange.exchange as QueueName;
  }

  publish: IExchange<QueueName, Argument>['publish'] = ((
    message: any,
    routingKey = '',
  ) => {
    this.channel.publish(this.name, message, routingKey);
  }) as IExchange<QueueName, Argument>['publish'];
}

class Channel<Arguments extends BaseArguments<keyof Arguments>> implements IChannel<Arguments> {
  declare channel;

  declare queues: IChannel<Arguments>['queues'];

  declare exchanges: IChannel<Arguments>['exchanges'];

  constructor(channel: IChannel<Arguments>['channel']) {
    this.channel = channel;
    this.queues = {};
    this.exchanges = {};
  }

  private isExistingQueue = (
    queueName: string,
  ) => (queueName in this.queues);

  private isExistingExchange = (
    exchangeName: string,
  ) => (exchangeName in this.exchanges);

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

  close: IChannel<Arguments>['close'] = () => new Promise((resolve) => {
    this.channel.close((error) => {
      if (error) throw error;

      resolve();
    });
  });

  createSender: IChannel<Arguments>['createSender'] = (
    queueName,
    options = {},
  ) => this.assertQueue(queueName, { durable: false, ...options });

  createPublisher: IChannel<Arguments>['createPublisher'] = (
    exchangeName,
    exchangeType,
    options = {},
  ) => this.asserExchange(exchangeName, exchangeType, { durable: false, ...options });

  createReceiver: IChannel<Arguments>['createReceiver'] = (async (
    queueName: keyof Arguments,
    consumeFunction: BaseConsumeFunction<Arguments[typeof queueName]>,
    prefetch?: number,
    assertOptions = {},
    consumeOptions = {},
  ) => {
    const queue = await this.assertQueue(
      queueName,
      { durable: false, ...assertOptions },
    );

    if (prefetch != null) {
      this.channel.prefetch(1);
    }
    await queue.setConsume(
      toParsedMessageConsumer(consumeFunction),
      { noAck: true, ...consumeOptions },
    );
    return queue;
  }) as IChannel<Arguments>['createReceiver'];

  createReceiverRPC: IChannel<Arguments>['createReceiverRPC'] = (async (
    queueName: keyof Arguments,
    consumeFunction: BaseConsumeFunction<Arguments[typeof queueName]>,
    prefetch?: number,
    assertOptions = {},
    consumeOptions = {},
    sendResponseOptions = {},
  ) => {
    return (this.createReceiver as IChannel<BaseArguments<string>>['createReceiver'])(
      queueName as string,
      async (message) => {
        if (message?.properties.replyTo != null) {
          const consumeReturn = consumeFunction(message);

          this.sendToQueue(
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
      assertOptions,
      consumeOptions,
    );
  }) as IChannel<Arguments>['createReceiverRPC'];

  createSubscriber: IChannel<Arguments>['createSubscriber'] = (async (
    exchangeName: keyof Arguments,
    exchangeType: ExchangeTypes,
    consumeFunction: BaseConsumeFunction<Arguments[typeof exchangeName]>,
    patterns = [''],
    exchangeOptions = {},
    queueOptions = {},
    consumeOptions = {},
  ) => {
    const exchange = await this.asserExchange(
      exchangeName,
      exchangeType,
      { durable: false, ...exchangeOptions },
    );
    const queue = await this.assertQueue(
      '' as keyof Arguments,
      { exclusive: true, ...queueOptions },
    );

    await Promise.all(
      patterns.map(
        (pattern) => this.bindQueue(
          queue.name.toString(),
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
      channel: this,
      exchange,
      queue,
      name: exchange.name,
    };
  }) as IChannel<Arguments>['createSubscriber'];

  assertQueue: IChannel<Arguments>['assertQueue'] = (
    queueName,
    options?,
  ) => new Promise((resolve) => {
    const strQueueName = queueName.toString();

    this.checkQueueAlreadyExists(strQueueName);

    this.channel.assertQueue(strQueueName, options, (error, queue) => {
      if (error) throw error;

      const queueClass = new Queue<typeof queueName, Arguments[typeof queueName]>(
        this as IChannel<{ [key in typeof queueName]: Arguments[typeof queueName] }>,
        queue,
      );

      this.queues[queueClass.name] = queueClass as IQueue<any, any>;
      resolve(queueClass);
    });
  });

  asserExchange: IChannel<Arguments>['asserExchange'] = (
    exchangeName,
    exchangeType,
    options?,
  ) => new Promise((resolve) => {
    const strExchangeName = exchangeName.toString();

    this.checkExchangeAlreadyExists(strExchangeName);

    this.channel.assertExchange(strExchangeName, exchangeType, options, (error, exchange) => {
      if (error) throw error;

      const exchangeClass = new Exchange<typeof exchangeName, Arguments[typeof exchangeName]>(
        this as IChannel<{ [key in typeof exchangeName]: Arguments[typeof exchangeName] }>,
        exchange,
      );
      this.exchanges[exchangeClass.name] = exchangeClass as IExchange<any, any>;
      resolve(exchangeClass);
    });
  });

  bindQueue: IChannel<Arguments>['bindQueue'] = (
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

  consumeQueue: IChannel<Arguments>['consumeQueue'] = (
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

  sendToQueue: IChannel<Arguments>['sendToQueue'] = (
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

  publish: IChannel<Arguments>['publish'] = (
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

  private static privateCreateChannel = <T extends BaseArguments<keyof T>>() => new Promise<IChannel<T>>((resolve) => {
    connection?.createChannel((error, channel) => {
      if (error) throw error;

      resolve(new Channel<T>(channel));
    });
  });

  static createChannel = async <T extends BaseArguments<keyof T> = BaseArguments<string>>(): Promise<IChannel<T>> => {
    if (this.isDisconnected()) {
      await this.connect();
    }
    return this.privateCreateChannel<T>();
  };
}
