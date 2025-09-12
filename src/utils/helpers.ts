import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { JWTPayload } from '../types';

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

export const generateToken = (payload: JWTPayload): string => {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};

export const generatePartId = (category: string): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  const categoryCode = category.substring(0, 3).toUpperCase();
  return `${categoryCode}-${timestamp}-${random}`;
};

export const calculateProgressPercentage = (
  completedProcessLines: number[],
  totalRequiredProcessLines: number[]
): number => {
  if (totalRequiredProcessLines.length === 0) return 0;
  return Math.round((completedProcessLines.length / totalRequiredProcessLines.length) * 100);
};

export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

export const isValidProcessLine = (lineNumber: number): boolean => {
  return lineNumber >= 1 && lineNumber <= 20;
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};
