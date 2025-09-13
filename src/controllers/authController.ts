import { Request, Response } from 'express';
import { User } from '../models/User';
import { LoginCredentials, RegisterData, APIResponse, JWTPayload, AuthenticatedRequest } from '../types';
import { hashPassword, comparePassword, generateToken, validateEmail, sanitizeInput } from '../utils/helpers';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      username,
      email,
      password,
      role,
      assignedProcessLine,
      firstName,
      lastName
    }: RegisterData = req.body;

    // Validation
    if (!username || !email || !password || !role || !firstName || !lastName) {
      const response: APIResponse = {
        success: false,
        message: 'All required fields must be provided'
      };
      res.status(400).json(response);
      return;
    }

    if (!validateEmail(email)) {
      const response: APIResponse = {
        success: false,
        message: 'Invalid email format'
      };
      res.status(400).json(response);
      return;
    }

    if (password.length < 6) {
      const response: APIResponse = {
        success: false,
        message: 'Password must be at least 6 characters long'
      };
      res.status(400).json(response);
      return;
    }

    if (role === 'worker' && !assignedProcessLine) {
      const response: APIResponse = {
        success: false,
        message: 'Process line assignment required for workers'
      };
      res.status(400).json(response);
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      const response: APIResponse = {
        success: false,
        message: 'Username or email already exists'
      };
      res.status(400).json(response);
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = new User({
      username: sanitizeInput(username),
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      assignedProcessLine: role === 'worker' ? assignedProcessLine : undefined,
      firstName: sanitizeInput(firstName),
      lastName: sanitizeInput(lastName)
    });

    await user.save();

    const response: APIResponse = {
      success: true,
      message: 'User registered successfully',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        assignedProcessLine: user.assignedProcessLine,
        firstName: user.firstName,
        lastName: user.lastName
      }
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Registration error:', error);
    const response: APIResponse = {
      success: false,
      message: 'Internal server error'
    };
    res.status(500).json(response);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password }: LoginCredentials = req.body;

    if (!username || !password) {
      const response: APIResponse = {
        success: false,
        message: 'Username and password are required'
      };
      res.status(400).json(response);
      return;
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user || !user.isActive) {
      const response: APIResponse = {
        success: false,
        message: 'Invalid credentials'
      };
      res.status(401).json(response);
      return;
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      const response: APIResponse = {
        success: false,
        message: 'Invalid credentials'
      };
      res.status(401).json(response);
      return;
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const tokenPayload: JWTPayload = {
      userId: (user._id as any).toString(),
      username: user.username,
      role: user.role,
      assignedProcessLine: user.assignedProcessLine
    };

    const token = generateToken(tokenPayload);

    const response: APIResponse = {
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          role: user.role,
          assignedProcessLine: user.assignedProcessLine,
          firstName: user.firstName,
          lastName: user.lastName
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    const response: APIResponse = {
      success: false,
      message: 'Internal server error'
    };
    res.status(500).json(response);
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    
    if (!user) {
      const response: APIResponse = {
        success: false,
        message: 'User not found'
      };
      res.status(404).json(response);
      return;
    }

    const response: APIResponse = {
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        assignedProcessLine: user.assignedProcessLine,
        firstName: user.firstName,
        lastName: user.lastName,
        lastLogin: user.lastLogin
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Get profile error:', error);
    const response: APIResponse = {
      success: false,
      message: 'Internal server error'
    };
    res.status(500).json(response);
  }
};
