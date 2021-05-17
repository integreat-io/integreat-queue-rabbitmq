import ava, { TestInterface } from 'ava'
import amqp = require('amqplib')

import queue from '.'

// Setup

interface AvaContext {
  channel: amqp.Channel
  consumerTag: string
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
}

async function subscribe(
  channel: amqp.Channel,
  queueName: string,
  cb: (msg: { content: Buffer } | null) => void
) {
  channel.assertQueue(queueName, { durable: true })
  const { consumerTag } = await channel.consume(queueName, cb, {
    noAck: true,
  })
  return consumerTag
}

test.before(async (t) => {
  const connection = await amqp.connect('amqp://localhost')
  t.context.channel = await connection.createChannel()
})

test.after.always(async (t) => {
  const { channel, consumerTag } = t.context
  if (channel && consumerTag) {
    channel.cancel(consumerTag)
  }
})

// Tests

test.cb('should push jobs to queue and return action id', (t) => {
  const queueName = 'testQueuePush1'
  const actionWithId = { ...action, meta: { ...action.meta, id: 'action1' } }
  const cb = (message: { content: Buffer } | null) => {
    if (message) {
      const content = JSON.parse(message.content.toString())
      t.deepEqual(content, actionWithId)
    } else {
      t.fail('Pushed with no content')
    }
    t.end()
  }
  subscribe(t.context.channel, queueName, cb).then((sub) => {
    t.context.consumerTag = sub
    queue({ queueName, rabbitmq: rabbitOptions }).then((q) => {
      q.push(actionWithId).then((id) => {
        t.is(id, 'action1')
      })
    })
  })
})

test.cb('should set id on action when none is given', (t) => {
  const queueName = 'testQueuePush2'
  const cb = (message: { content: Buffer } | null) => {
    if (message) {
      const content = JSON.parse(message.content.toString())
      t.is(content.type, 'SET')
      t.is(typeof content.meta.id, 'string')
    } else {
      t.fail('Pushed with no content')
    }
    t.end()
  }
  subscribe(t.context.channel, queueName, cb).then((sub) => {
    t.context.consumerTag = sub
    queue({ queueName, rabbitmq: rabbitOptions }).then((q) => {
      q.push(action).then((id) => {
        t.is(typeof id, 'string')
      })
    })
  })
})

test.cb('should do nothing when no action', (t) => {
  t.plan(2)
  const queueName = 'testQueuePush3'
  const action = null
  const cb = () => {
    throw new Error('Should not push empty action')
  }
  subscribe(t.context.channel, queueName, cb).then((sub) => {
    t.context.consumerTag = sub
    queue({ queueName, rabbitmq: rabbitOptions }).then((q) => {
      q.push(action).then((id) => {
        t.is(id, null)
        setTimeout(function () {
          t.pass() // Need this, as Ava will sometimes time out silently
          t.end()
        }, 200)
      })
    })
  })
})
