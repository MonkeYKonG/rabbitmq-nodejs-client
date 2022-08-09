const RabbitMQClient = require('../dist/rabbitmq').default;

describe('Connection', () => {
  describe('RabbitMQClient', () => {
    test('Success', async () => {
      await RabbitMQClient.connect();
      expect(RabbitMQClient.isConnected()).toBe(true);
      expect(RabbitMQClient.isDisconnected()).toBe(false);
      await RabbitMQClient.close();
      expect(RabbitMQClient.isConnected()).toBe(false);
      expect(RabbitMQClient.isDisconnected()).toBe(true);
    });

    test('Unknown host', async () => {
      await expect(RabbitMQClient.connect('UNKNOW')).rejects.toThrow(/getaddrinfo [\w_]+ unknow/);
      expect(RabbitMQClient.isConnected()).toBe(false);
      expect(RabbitMQClient.isDisconnected()).toBe(true);
    }, 5000);
  });
});

describe('Creations', () => {
  beforeAll(async () => {
    await RabbitMQClient.connect();
  });

  afterAll(async () => {
    await RabbitMQClient.close();
  });

  describe('Sender', () => {
    test('Create named queue', async () => {
      const queueName = 'testQueue';
      const channel = await RabbitMQClient.createChannel();
      const queue = await channel.createSender(queueName);

      expect(queue.name).toBe(queueName);
      expect(channel.queues[queueName]).not.toBe(undefined);
      await channel.close();
    });

    test('Create unnamed queue', async () => {
      const queueName = '';
      const channel = await RabbitMQClient.createChannel();
      const queue = await channel.createSender(queueName);

      expect(queue.name).not.toBe(queueName);
      expect(channel.queues[queue.name]).not.toBe(undefined);
      await channel.close();
    });
  });

  describe('Receiver', () => {
    test('Create named queue', async () => {
      const queueName = 'testQueue';
      const channel = await RabbitMQClient.createChannel();
      const queue = await channel.createReceiver(queueName, () => null);

      expect(queue.name).toBe(queueName);
      expect(channel.queues[queueName]).not.toBe(undefined);
      await channel.close();
    });

    test('Create unnamed queue', async () => {
      const queueName = '';
      const channel = await RabbitMQClient.createChannel();
      const queue = await channel.createReceiver(queueName, () => null);

      expect(queue.name).not.toBe(queueName);
      expect(channel.queues[queue.name]).not.toBe(undefined);
      await channel.close();
    });
  });

  describe('Publisher', () => {
    test('Create named publisher', async () => {
      const exchangeName = 'testExchange';
      const channel = await RabbitMQClient.createChannel();
      const exchange = await channel.createPublisher(exchangeName, 'fanout');

      expect(exchange.name).toBe(exchangeName);
      expect(channel.exchanges[exchangeName]).not.toBe(undefined);
      await channel.close();
    });
  });

  describe('Subscriber', () => {
    test('Create named Subscriber', async () => {
      const exchangeName = 'testExchange';
      const channel = await RabbitMQClient.createChannel();
      const { exchange, queue } = await channel.createSubscriber(exchangeName, 'fanout', () => null);

      expect(exchange.name).toBe(exchangeName);
      expect(channel.exchanges[exchangeName]).not.toBe(undefined);
      expect(channel.queues[queue.name]).not.toBe(undefined);
      await channel.close();
    });
  });
});

describe('Sender Receiver', () => {
  beforeEach(async () => {
    await RabbitMQClient.connect();
  });

  afterEach(async () => {
    await RabbitMQClient.close();
  });

  test('Send string', (done) => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = 'My test message';
    const queueName = 'testQueue';

    Promise.all([
      RabbitMQClient.createChannel(),
      RabbitMQClient.createChannel(),
    ])
      .then(([channelReceiver, channelSender]) => {
        Promise.all([
          channelSender.createSender(queueName),
          channelReceiver.createReceiver(queueName, (message) => {
            expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
            expect(message.content).toBe(testMessage);
            done();
          }),
        ]).then(([sender]) => {
          sender.send(testMessage);
        });
      });
  });

  test('Send JSON', (done) => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = { message: 'My test message' };
    const queueName = 'testQueue';

    Promise.all([
      RabbitMQClient.createChannel(),
      RabbitMQClient.createChannel(),
    ])
      .then(([channelReceiver, channelSender]) => {
        Promise.all([
          channelSender.createSender(queueName),
          channelReceiver.createReceiver(queueName, (message) => {
            expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
            expect(message.content).toMatchObject(testMessage);
            done();
          }),
        ]).then(([sender]) => {
          sender.send(testMessage);
        });
      });
  });

  test('Async receiver', (done) => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = 'My test message';
    const queueName = 'testQueue';

    Promise.all([
      RabbitMQClient.createChannel(),
      RabbitMQClient.createChannel(),
    ])
      .then(([channelReceiver, channelSender]) => {
        Promise.all([
          channelSender.createSender(queueName),
          channelReceiver.createReceiver(queueName, async (message) => {
            expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
            expect(message.content).toBe(testMessage);
            done();
          }),
        ]).then(([sender]) => {
          sender.send(testMessage);
        });
      });
  });
});

describe('Publisher Subscriber', () => {
  beforeEach(async () => {
    await RabbitMQClient.connect();
  });

  afterEach(async () => {
    await RabbitMQClient.close();
  });

  test('Send string', (done) => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = 'My test message';
    const exchangeName = 'testExchange';

    Promise.all([
      RabbitMQClient.createChannel(),
      RabbitMQClient.createChannel(),
    ])
      .then(([channelSubscriber, channelPublisher]) => {
        Promise.all([
          channelSubscriber.createPublisher(exchangeName, 'fanout'),
          channelPublisher.createSubscriber(exchangeName, 'fanout', (message) => {
            expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
            expect(message.content).toBe(testMessage);
            done();
          }),
        ]).then(([sender]) => {
          sender.publish(testMessage);
        });
      });
  });

  test('Send JSON', (done) => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = { message: 'My test message' };
    const exchangeName = 'testExchange';

    Promise.all([
      RabbitMQClient.createChannel(),
      RabbitMQClient.createChannel(),
    ])
      .then(([channelSubscriber, channelPublisher]) => {
        Promise.all([
          channelSubscriber.createPublisher(exchangeName, 'fanout'),
          channelPublisher.createSubscriber(exchangeName, 'fanout', (message) => {
            expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
            expect(message.content).toMatchObject(testMessage);
            done();
          }),
        ]).then(([sender]) => {
          sender.publish(testMessage);
        });
      });
  });

  test('Async subscriber', (done) => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = 'My test message';
    const exchangeName = 'testExchange';

    Promise.all([
      RabbitMQClient.createChannel(),
      RabbitMQClient.createChannel(),
    ])
      .then(([channelSubscriber, channelPublisher]) => {
        Promise.all([
          channelSubscriber.createPublisher(exchangeName, 'fanout'),
          channelPublisher.createSubscriber(exchangeName, 'fanout', (message) => {
            expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
            expect(message.content).toBe(testMessage);
            done();
          }),
        ]).then(([sender]) => {
          sender.publish(testMessage);
        });
      });
  });
});

describe('RPC', () => {
  beforeEach(async () => {
    await RabbitMQClient.connect();
  });

  afterEach(async () => {
    await RabbitMQClient.close();
  });

  test('Send string answer string', async () => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = 'My test message';
    const testResponse = 'My test response';
    const queueName = 'testQueue';
    const channelReceiver = await RabbitMQClient.createChannel();
    const channelSender = await RabbitMQClient.createChannel();

    await channelReceiver.createReceiverRPC(queueName, (message) => {
      expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
      expect(message.content).toBe(testMessage);
      return testResponse;
    });
    const queue = await channelSender.createSender(queueName);
    const response = await queue.sendRPC(testMessage);

    expect(response).toBe(testResponse);
  });

  test('Send JSON answer string', async () => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = { message: 'My test message' };
    const testResponse = 'My test response';
    const queueName = 'testQueue';
    const channelReceiver = await RabbitMQClient.createChannel();
    const channelSender = await RabbitMQClient.createChannel();

    await channelReceiver.createReceiverRPC(queueName, (message) => {
      expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
      expect(message.content).toMatchObject(testMessage);
      return testResponse;
    });
    const queue = await channelSender.createSender(queueName);
    const response = await queue.sendRPC(testMessage);

    expect(response).toBe(testResponse);
  });

  test('Send string answer JSON', async () => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = 'My test message';
    const testResponse = { message: 'My test response' };
    const queueName = 'testQueue';
    const channelReceiver = await RabbitMQClient.createChannel();
    const channelSender = await RabbitMQClient.createChannel();

    await channelReceiver.createReceiverRPC(queueName, (message) => {
      expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
      expect(message.content).toBe(testMessage);
      return testResponse;
    });
    const queue = await channelSender.createSender(queueName);
    const response = await queue.sendRPC(testMessage);

    expect(response).toMatchObject(testResponse);
  });

  test('Send JSON answer JSON', async () => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = { message: 'My test message' };
    const testResponse = { message: 'My test response' };
    const queueName = 'testQueue';
    const channelReceiver = await RabbitMQClient.createChannel();
    const channelSender = await RabbitMQClient.createChannel();

    await channelReceiver.createReceiverRPC(queueName, (message) => {
      expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
      expect(message.content).toMatchObject(testMessage);
      return testResponse;
    });
    const queue = await channelSender.createSender(queueName);
    const response = await queue.sendRPC(testMessage);

    expect(response).toMatchObject(testResponse);
  });

  test('Async RPC server', async () => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = 'My test message';
    const testResponse = 'My test response';
    const queueName = 'testQueue';
    const channelReceiver = await RabbitMQClient.createChannel();
    const channelSender = await RabbitMQClient.createChannel();

    await channelReceiver.createReceiverRPC(queueName, async (message) => {
      expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
      expect(message.content).toBe(testMessage);
      return testResponse;
    });
    const queue = await channelSender.createSender(queueName);
    const response = await queue.sendRPC(testMessage);

    expect(response).toBe(testResponse);
  });
})