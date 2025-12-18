const { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const config = require('../config');
const logger = require('../utils/logger');

class SQSService {
    constructor() {
        this.sqsClient = new SQSClient({
            region: config.aws.region,
            credentials: {
                accessKeyId: config.aws.accessKeyId,
                secretAccessKey: config.aws.secretAccessKey,
            },
        });
        this.queueUrl = config.aws.sqsQueueUrl;
    }

    get client() {
        return this.sqsClient;
    }

    /**
     * Sends a message to the SQS queue.
     * @param {Object} body - The message body (will be JSON stringified).
     */
    async sendMessage(body) {
        try {
            const command = new SendMessageCommand({
                QueueUrl: this.queueUrl,
                MessageBody: JSON.stringify(body),
            });
            const response = await this.sqsClient.send(command);
            logger.info(`Message sent to SQS: ${response.MessageId}`);
            return response;
        } catch (error) {
            logger.error(error, 'Failed to send message to SQS');
            throw error;
        }
    }

    /**
     * Receives messages from the SQS queue.
     * @param {number} maxMessages - Maximum number of messages to receive (default 1).
     * @param {number} waitTimeSeconds - Long polling wait time (default 20).
     */
    async receiveMessage(maxMessages = 1, waitTimeSeconds = 20) {
        try {
            const command = new ReceiveMessageCommand({
                QueueUrl: this.queueUrl,
                MaxNumberOfMessages: maxMessages,
                WaitTimeSeconds: waitTimeSeconds,
            });
            const response = await this.sqsClient.send(command);
            return response.Messages || [];
        } catch (error) {
            logger.error(error, 'Failed to receive message from SQS');
            throw error;
        }
    }

    /**
     * Deletes a message from the SQS queue.
     * @param {string} receiptHandle - The receipt handle of the message to delete.
     */
    async deleteMessage(receiptHandle) {
        try {
            const command = new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: receiptHandle,
            });
            await this.sqsClient.send(command);
            logger.info('Message deleted from SQS');
        } catch (error) {
            logger.error(error, 'Failed to delete message from SQS');
            throw error;
        }
    }
}

module.exports = new SQSService();
