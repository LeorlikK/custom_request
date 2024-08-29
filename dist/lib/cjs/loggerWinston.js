"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.printf(({ level, message, service, timestamp }) => {
        return `${(new Date(timestamp).toLocaleTimeString()).toString()} [${service}]: ${message}`;
    })),
    transports: [
        new winston_1.default.transports.File({ filename: 'logs/error.log', level: 'error' }),
    ]
});
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console());
}
exports.default = logger;
