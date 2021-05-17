import ava, { TestInterface } from 'ava'
import sinon = require('sinon')
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

const wait = async (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms))

test.before(async (t) => {
  const connection = await amqp.connect('amqp://localhost')
  t.context.channel = await connection.createChannel()
})

// Tests -- subscribe

test('should subscribe to queue', async (t) => {
  const queueName = 'testQueueSubscribe1'
  const handler = sinon
    .stub()
    .resolves({ ...action, response: { status: 'ok', data: [] } })
  const q = await createQueue({ queueName, rabbitmq: rabbitOptions })

  const handle = await q.subscribe(handler)
  await q.push(action)

  await wait(200)
  t.is(handler.callCount, 1)

  q.unsubscribe(handle)
})

test('should skip messages with invalid JSON', async (t) => {
  const queueName = 'testQueueSubscribe2'
  const handler = sinon
    .stub()
    .resolves({ ...action, response: { status: 'ok', data: [] } })
  const q = await createQueue({ queueName, rabbitmq: rabbitOptions })

  const handle = await q.subscribe(handler)
  await t.context.channel.assertQueue(queueName, { durable: true })
  t.context.channel.sendToQueue(queueName, Buffer.from('Invalid'))

  await wait(200)
  t.is(handler.callCount, 0)

  q.unsubscribe(handle)
})

test('should retry message when handler throws', async (t) => {
  const queueName = 'testQueueSubscribe3'
  const handler = sinon
    .stub()
    .resolves({ ...action, response: { status: 'ok', data: [] } })
    .onFirstCall()
    .rejects(new Error('Not ready!'))
  const q = await createQueue({ queueName, rabbitmq: rabbitOptions })

  const handle = await q.subscribe(handler)
  await q.push(action)

  await wait(200)
  t.is(handler.callCount, 2)

  q.unsubscribe(handle)
})

test('should throw when handler is not a function', async (t) => {
  const queueName = 'testQueueSubscribe4'
  const handler = null
  const q = await createQueue({ queueName, rabbitmq: rabbitOptions })

  await t.throwsAsync(q.subscribe(handler as any))
})

test('should have maxConcurrency = 1 as default', async (t) => {
  const queueName = 'testQueueSubscribe5'
  const handler = sinon.stub().callsFake(async function () {
    await wait(300)
    return {
      ...action,
      response: { status: 'ok', data: [] },
    }
  })
  const q = await createQueue({ queueName, rabbitmq: rabbitOptions })

  const handle = await q.subscribe(handler)
  await q.push(action)
  await q.push(action)

  await wait(200)
  t.is(handler.callCount, 1)

  q.unsubscribe(handle)
  await wait(500)
  await t.context.channel.purgeQueue(queueName)
})

test('should use given maxConcurrency', async (t) => {
  const queueName = 'testQueueSubscribe6'
  const handler = sinon.stub().callsFake(async function () {
    await wait(300)
    return {
      ...action,
      response: { status: 'ok', data: [] },
    }
  })
  const q = await createQueue({
    queueName,
    maxConcurrency: 2,
    rabbitmq: rabbitOptions,
  })

  const handle = await q.subscribe(handler)
  await q.push(action)
  await q.push(action)

  await wait(200)
  t.is(handler.callCount, 2)

  q.unsubscribe(handle)
  await wait(500)
  await t.context.channel.purgeQueue(queueName)
})

// Tests -- unsubscribe

test('should unsubscribe from queue', async (t) => {
  const queueName = 'testQueueUnsubscribe1'
  await t.context.channel.assertQueue(queueName, { durable: true })
  const handler = sinon
    .stub()
    .resolves({ ...action, response: { status: 'ok', data: [] } })
  const q = await createQueue({ queueName, rabbitmq: rabbitOptions })

  const handle = await q.subscribe(handler)
  await q.unsubscribe(handle)
  await q.push(action)

  await wait(200) // Make sure there would have been time for the message to reach the handle
  t.is(handler.callCount, 0)

  await t.context.channel.purgeQueue(queueName)
})

test('should do nothing when unsubscribe is attempted without queue name', async (t) => {
  const queueName = 'testQueueUnsubscribe2'
  const q = await createQueue({ queueName, rabbitmq: rabbitOptions })

  await t.notThrowsAsync(q.unsubscribe(null))
})
