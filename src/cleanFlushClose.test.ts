import ava, { TestInterface } from 'ava'
import amqp = require('amqplib')

import createQueue from '.'

// Setup

interface AvaContext {
  channel: amqp.Channel
}

const test = ava as TestInterface<AvaContext>

const action = {
  type: 'SET',
  payload: {
    type: 'entry',
    data: [{ id: 'ent1', $type: 'entry', title: 'Entry 1' }],
  },
  meta: { ident: { id: 'johnf' }, queue: true },
}

const rabbitOptions = {
  hostname: 'localhost',
  port: 5672,
  username: process.env.RABBITMQ_USERNAME || undefined,
  password: process.env.RABBITMQ_PASSWORD || undefined,
}

test.before(async (t) => {
  const connection = await amqp.connect('amqp://localhost')
  t.context.channel = await connection.createChannel()
})

// Tests -- clean

test('should do nothing when clean is called', async (t) => {
  const queueName = 'testQueueClean1'
  const q = await createQueue({ queueName, rabbitmq: rabbitOptions })

  await t.notThrowsAsync(q.clean())
})

// Tests -- flush

test('should flush all jobs in the queue', async (t) => {
  const queueName = 'testQueueFlush1'
  const q = await createQueue({ queueName, rabbitmq: rabbitOptions })

  await q.push(action)
  await q.flush()

  const ret = await t.context.channel.get(queueName, { noAck: true })
  t.false(ret, 'There was one or more jobs in the queue')
  await t.context.channel.purgeQueue(queueName)
})

// Tests -- close

test('should do nothing when close is called', async (t) => {
  const queueName = 'testQueueClose1'
  const q = await createQueue({ queueName, rabbitmq: rabbitOptions })

  await t.notThrowsAsync(q.close())
})
