import amqp = require('amqplib')
import { nanoid } from 'nanoid'
import debug = require('debug')

const debugWarn = debug('warn')

export const isObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

export interface Options {
  queueName: string
  rabbitmq: {
    hostname?: string
    port?: number
    username?: string
    password?: string
  }
}

export interface Action {
  type: string
  payload: Record<string, unknown>
  response?: Record<string, unknown>
  meta?: Record<string, unknown>
}

export interface Handler {
  (data: Action): Promise<Action>
}

function parseJSON(json: string) {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

const callHandler = (handler: Handler, channel: amqp.Channel) =>
  async function (message: amqp.Message | null) {
    if (message) {
      const content = message.content.toString()
      const action = parseJSON(content)
      if (action) {
        try {
          await handler(action)
          channel.ack(message)
        } catch {
          channel.reject(message, true) // requeue
        }
      } else {
        channel.reject(message, false) // don't requeue job with invalid JSON
        debugWarn('Queue: Rejected job with invalid JSON.', content)
      }
    }
  }

// TODO: maxConcurrency

/**
 * Create and return an Integreat queue for RabbitMQ. The options are an object
 * with `queueName` and a `rabbitmq` options object. The latter will be passed
 * on to RabbitMQ.
 */
export default async function (options: Options) {
  const connection = await amqp.connect(options.rabbitmq)
  const channel = await connection.createChannel()
  const { queueName } = options
  const exchName = `${options.queueName}_exch`

  await channel.assertExchange(exchName, 'direct', { durable: true })
  await channel.assertQueue(queueName, { durable: true })
  channel.bindQueue(queueName, exchName, '')

  return {
    /**
     * Push a job to the queue and return its id. If the action has no id, an
     * id will be generated.
     */
    async push(action?: Action | null) {
      if (isObject(action)) {
        const id = action.meta?.id || nanoid()
        const data = JSON.stringify({ ...action, meta: { ...action.meta, id } })
        channel.publish(exchName, '', Buffer.from(data), {
          persistent: true,
          contentType: 'application/json',
        })
        return id
      } else {
        return null
      }
    },

    /**
     * Subscribe to queue. Any job from the queue will be passed on to the
     * subscribed handlers. Returns a subscription handle, used for
     * unsubscribing.
     */
    async subscribe(handler: Handler) {
      if (typeof handler !== 'function') {
        throw TypeError('Queue handler must be a function')
      }
      const { consumerTag } = await channel.consume(
        queueName,
        callHandler(handler, channel),
        { noAck: false }
      )
      return consumerTag
    },

    /**
     * Unsubscribe from scheduler queue. Subscription is identified with the
     * handler from the `subscribe` method.
     */
    async unsubscribe(consumerTag: unknown) {
      if (channel && typeof consumerTag === 'string') {
        await channel.cancel(consumerTag)
      }
    },
  }
}
