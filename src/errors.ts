export namespace RABBITMQ {
  const prefix = 'rabbitmq_';

  export const NOT_CONNECTED = `${prefix}not_connected`;
  export const CHANNEL_ALREADY_EXISTS = `${prefix}channel_arlready_exists`;
  export const QUEUE_ALREADY_EXISTS = `${prefix}queue_arlready_exists`;
  export const QUEUE_NOT_EXISTS = `${prefix}queue_not_exists`;
  export const EXCHANGE_ALREADY_EXISTS = `${prefix}exchange_arlready_exists`;
  export const EXCHANGE_NOT_EXISTS = `${prefix}exchange_not_exists`;
}
