import RabbitMQClient from '../dist/rabbitmq';

describe('Creations', () => {
  describe('Sender', () => {
    test('Create named queue', async () => {
      const queueName = 'testQueue';
      const { channel, queue, name } = await RabbitMQClient.createSender(queueName);

      expect(name).toBe(queueName);
      expect(queue.name).toBe(queueName);
      expect(channel.queues[queueName]).not.toBe(undefined);
    });

    test('Create unnamed queue', async () => {
      const queueName = '';
      const { channel, queue, name } = await RabbitMQClient.createSender(queueName);

      expect(name).not.toBe(queueName);
      expect(queue.name).toBe(name);
      expect(channel.queues[name]).not.toBe(undefined);
    });
  });

  describe('Receiver', () => {
    test('Create named queue', async () => {
      const queueName = 'testQueue';
      const { channel, queue, name } = await RabbitMQClient.createReceiver(queueName);

      expect(name).toBe(queueName);
      expect(queue.name).toBe(queueName);
      expect(channel.queues[queueName]).not.toBe(undefined);
    });

    test('Create unnamed queue', async () => {
      const queueName = '';
      const { channel, queue, name } = await RabbitMQClient.createReceiver(queueName);

      expect(name).not.toBe(queueName);
      expect(queue.name).toBe(name);
      expect(channel.queues[name]).not.toBe(undefined);
    });
  })
});

// describe('Sender Receiver', () => {
//   let sender;
//   let receiver;

//   test('create sender', async () => {
//     const queueName = 'testQueue';
//     const { channel, queue, name } = await RabbitMQClient.createSender(queueName);

//     expect(name).toBe(queueName);
//     expect(queue.name).toBe(queueName);
//   })

//   test('send string', async () => {
//     const expectedMessageKeys = ['content', 'fields', 'properties'];
//     const testMessage = 'My test message';
//     const queueName = 'testQueue';
//     const { queue } = await RabbitMQClient.createSender(queueName);

//     expect(queue.name).toBe(queueName);

//     await RabbitMQClient.createReceiver(queueName, (message) => {
//       expect(Object.keys(message)).toBe(expect.arrayContaining(expectedMessageKeys));
//       expect(message.content).toBe(testMessage);
//     });
//   });
// });