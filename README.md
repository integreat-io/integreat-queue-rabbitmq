# RabbitMQ queue for Integreat

This implementation is based on [amqp.node](https://github.com/squaremo/amqp.node).

[![npm Version](https://img.shields.io/npm/v/integreat-queue-rabbitmq.svg)](https://www.npmjs.com/package/integreat-queue-rabbitmq)
[![Build Status](https://travis-ci.org/integreat-io/integreat-queue-rabbitmq.svg?branch=master)](https://travis-ci.org/integreat-io/integreat-queue-rabbitmq)
[![Coverage Status](https://coveralls.io/repos/github/integreat-io/integreat-queue-rabbitmq/badge.svg?branch=master)](https://coveralls.io/github/integreat-io/integreat-queue-rabbitmq?branch=master)
[![Dependencies Status](https://tidelift.com/badges/github/integreat-io/integreat-queue-rabbitmq?style=flat)](https://tidelift.com/subscriber/github/integreat-io/repositories/integreat-queue-rabbitmq)

## Getting started

### Prerequisits

Requires node v14 and Integreat v0.8.

### Installing

Install from npm:

```
npm install integreat-queue-rabbitmq
```

#### Options

- `queueName` is used directly as the queue name in RabbitMQ. An exchange is
  created with the name `<queueName>_exch`.
- `maxConcurrency` specifies how many jobs may be picked from the queue before
  any of them is completed (acknowledged or rejected). Default is `1`, meaning
  a new job will not be picked until the current one is done. Note that for
  RabbitMQ v3.3.0 and later, this is limited to a channel, i.e. one instance
  of an Integreat queue, so with a `maxConcurrency` of 1 on several instances,
  each one may pick one job. In versions before v3.3.0, only one job could be
  picked across all subscribers.
- `rabbitmq` may be an url string or the options object required by the
  [`connect()`](http://www.squaremobius.net/amqp.node/channel_api.html#connect)
  method of the `amqp` client. The most common props of this object are
  `hostname`, `port`, `username`, and `password`.

### Running the tests

The tests can be run with `npm test`.

## Contributing

Please read
[CONTRIBUTING](https://github.com/integreat-io/integreat-queue-rabbitmq/blob/master/CONTRIBUTING.md)
for details on our code of conduct, and the process for submitting pull
requests.

## License

This project is licensed under the ISC License - see the
[LICENSE](https://github.com/integreat-io/integreat-queue-rabbitmq/blob/master/LICENSE)
file for details.
