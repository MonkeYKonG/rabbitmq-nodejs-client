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
    });
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
      const { channel, queue, name } = await RabbitMQClient.createSender(queueName);

      expect(name).toBe(queueName);
      expect(queue.name).toBe(queueName);
      expect(channel.queues[queueName]).not.toBe(undefined);
      await channel.close();
    });

    test('Create unnamed queue', async () => {
      const queueName = '';
      const { channel, queue, name } = await RabbitMQClient.createSender(queueName);

      expect(name).not.toBe(queueName);
      expect(queue.name).toBe(name);
      expect(channel.queues[name]).not.toBe(undefined);
      await channel.close();
    });
  });

  describe('Receiver', () => {
    test('Create named queue', async () => {
      const queueName = 'testQueue';
      const { channel, queue, name } = await RabbitMQClient.createReceiver(queueName);

      expect(name).toBe(queueName);
      expect(queue.name).toBe(queueName);
      expect(channel.queues[queueName]).not.toBe(undefined);
      await channel.close();
    });

    test('Create unnamed queue', async () => {
      const queueName = '';
      const { channel, queue, name } = await RabbitMQClient.createReceiver(queueName);

      expect(name).not.toBe(queueName);
      expect(queue.name).toBe(name);
      expect(channel.queues[name]).not.toBe(undefined);
      await channel.close();
    });
  });

  describe('Publisher', () => {
    test('Create named publisher', async () => {
      const exchangeName = 'testExchange';
      const { channel, exchange, name } = await RabbitMQClient.createPublisher(exchangeName, 'fanout');

      expect(name).toBe(exchangeName);
      expect(exchange.name).toBe(name);
      expect(channel.exchanges[name]).not.toBe(undefined);
      await channel.close();
    });
  });

  describe('Subscriber', () => {
    test('Create named Subscriber', async () => {
      const exchangeName = 'testExchange';
      const { channel, exchange, queue, name } = await RabbitMQClient.createSubscriber(exchangeName, 'fanout');

      expect(name).toBe(exchangeName);
      expect(name).not.toBe(queue.name);
      expect(exchange.name).toBe(name);
      expect(channel.exchanges[name]).not.toBe(undefined);
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
      RabbitMQClient.createSender(queueName),
      RabbitMQClient.createReceiver(queueName, (message) => {
        expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
        expect(message.content).toBe(testMessage);
        done();
      }),
    ]).then(([sender, receiver]) => {
      sender.queue.send(testMessage);
    });
  });

  test('Send JSON', (done) => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = { message: 'My test message' };
    const queueName = 'testQueue';

    Promise.all([
      RabbitMQClient.createSender(queueName),
      RabbitMQClient.createReceiver(queueName, (message) => {
        expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
        expect(message.content).toMatchObject(testMessage);
        done();
      }),
    ]).then(([sender, receiver]) => {
      sender.queue.send(testMessage);
    });
  });

  test('Async receiver', (done) => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = 'My test message';
    const queueName = 'testQueue';

    Promise.all([
      RabbitMQClient.createSender(queueName),
      RabbitMQClient.createReceiver(queueName, async (message) => {
        expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
        expect(message.content).toBe(testMessage);
        done();
      }),
    ]).then(([sender, receiver]) => {
      sender.queue.send(testMessage);
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
      RabbitMQClient.createPublisher(exchangeName, 'fanout'),
      RabbitMQClient.createSubscriber(exchangeName, 'fanout', (message) => {
        expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
        expect(message.content).toBe(testMessage);
        done();
      }),
    ]).then(([sender, receiver]) => {
      sender.exchange.publish(testMessage);
    });
  });

  test('Send JSON', (done) => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = { message: 'My test message' };
    const exchangeName = 'testExchange';

    Promise.all([
      RabbitMQClient.createPublisher(exchangeName, 'fanout'),
      RabbitMQClient.createSubscriber(exchangeName, 'fanout', (message) => {
        expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
        expect(message.content).toMatchObject(testMessage);
        done();
      }),
    ]).then(([sender, receiver]) => {
      sender.exchange.publish(testMessage);
    });
  });

  test('Async subscriber', (done) => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = 'My test message';
    const exchangeName = 'testExchange';

    Promise.all([
      RabbitMQClient.createPublisher(exchangeName, 'fanout'),
      RabbitMQClient.createSubscriber(exchangeName, 'fanout', async (message) => {
        expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
        expect(message.content).toBe(testMessage);
        done();
      }),
    ]).then(([sender, receiver]) => {
      sender.exchange.publish(testMessage);
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

    await RabbitMQClient.createReceiverRPC(queueName, (message) => {
      expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
      expect(message.content).toBe(testMessage);
      return testResponse;
    });
    const { queue } = await RabbitMQClient.createSender(queueName);
    const response = await queue.sendRPC(testMessage);

    expect(response).toBe(testResponse);
  });

  test('Send JSON answer string', async () => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = { message: 'My test message' };
    const testResponse = 'My test response';
    const queueName = 'testQueue';

    await RabbitMQClient.createReceiverRPC(queueName, (message) => {
      expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
      expect(message.content).toMatchObject(testMessage);
      return testResponse;
    });
    const { queue } = await RabbitMQClient.createSender(queueName);
    const response = await queue.sendRPC(testMessage);

    expect(response).toBe(testResponse);
  });

  test('Send string answer JSON', async () => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = 'My test message';
    const testResponse = { message: 'My test response' };
    const queueName = 'testQueue';

    await RabbitMQClient.createReceiverRPC(queueName, (message) => {
      expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
      expect(message.content).toBe(testMessage);
      return testResponse;
    });
    const { queue } = await RabbitMQClient.createSender(queueName);
    const response = await queue.sendRPC(testMessage);

    expect(response).toMatchObject(testResponse);
  });

  test('Send JSON answer JSON', async () => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = { message: 'My test message' };
    const testResponse = { message: 'My test response' };
    const queueName = 'testQueue';

    await RabbitMQClient.createReceiverRPC(queueName, (message) => {
      expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
      expect(message.content).toMatchObject(testMessage);
      return testResponse;
    });
    const { queue } = await RabbitMQClient.createSender(queueName);
    const response = await queue.sendRPC(testMessage);

    expect(response).toMatchObject(testResponse);
  });

  test('Async RPC server', async () => {
    const expectedMessageKeys = ['fields', 'properties', 'content'];
    const testMessage = 'My test message';
    const testResponse = 'My test response';
    const queueName = 'testQueue';

    await RabbitMQClient.createReceiverRPC(queueName, async (message) => {
      expect(Object.keys(message)).toEqual(expect.arrayContaining(expectedMessageKeys));
      expect(message.content).toBe(testMessage);
      return testResponse;
    });
    const { queue } = await RabbitMQClient.createSender(queueName);
    const response = await queue.sendRPC(testMessage);

    expect(response).toBe(testResponse);
  });
})