import { Device } from "../../models/Device";
import { User } from "../user/user.model";
import {
  LoginDTO,
  LoginResult,
  MonitorLoginDTO,
  MonitorLoginResult,
  ProfileResult,
  RegisterDTO,
  RegisterResult,
  WorkerLoginDTO,
  WorkerLoginResult
} from "./auth.types";
import {
  comparePassword,
  generateToken,
  hashPassword,
  sanitizeInput,
  validateEmail
} from "@shared/helpers";
import { JWTPayload } from "../../types";

export class AuthService {
  async register(input: RegisterDTO): Promise<RegisterResult> {
    const { username, name, email, password, role } = input;

    if (email && !validateEmail(email)) {
      throw new Error("Invalid email format");
    }

    const orConditions: any[] = [];
    if (username) orConditions.push({ username });
    if (email) orConditions.push({ email });

    const existingUser =
      orConditions.length > 0
        ? await User.findOne({ $or: orConditions })
        : null;

    if (existingUser) {
      const error: any = new Error("Employee number or email already exists");
      error.code = "CONFLICT";
      throw error;
    }

    const hashedPassword = await hashPassword(password);

    const user = new User({
      username: username ? sanitizeInput(username) : undefined,
      name: sanitizeInput(name),
      email: email ? email.toLowerCase() : undefined,
      password: hashedPassword,
      role
    });

    await user.save();

    return {
      id: (user._id as any).toString(),
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  async login(input: LoginDTO): Promise<LoginResult> {
    const { username, password } = input;

    const user = await User.findOne({
      $or: [{ email: username }, { username: username }]
    });

    if (!user || !user.isActive) {
      const error: any = new Error("Invalid credentials");
      error.code = "INVALID_CREDENTIALS";
      throw error;
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      const error: any = new Error("Invalid credentials");
      error.code = "INVALID_CREDENTIALS";
      throw error;
    }

    user.lastLoginAt = new Date();
    await user.save();

    const accessTokenPayload: JWTPayload = {
      sub: (user._id as any).toString(),
      role: user.role,
      ...(user.role === "worker" && user.username
        ? { username: user.username }
        : {})
    };

    const tokenExpiration = user.role === "monitor" ? "365d" : "24h";
    const accessToken = generateToken(accessTokenPayload, tokenExpiration);

    return {
      user: {
        id: (user._id as any).toString(),
        name: user.name,
        role: user.role,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      },
      accessToken
    };
  }

  async workerLogin(input: WorkerLoginDTO): Promise<WorkerLoginResult> {
    const { workerId, deviceId } = input;

    const worker = await User.findById(workerId);

    if (!worker || worker.role !== "worker") {
      const error: any = new Error("Invalid worker ID");
      error.code = "INVALID_CREDENTIALS";
      throw error;
    }

    const device = await Device.findById(deviceId).setOptions({
      includeDeleted: false
    });

    if (!device) {
      const error: any = new Error("Device not found");
      error.code = "NOT_FOUND";
      throw error;
    }

    if (device.status === "MAINTENANCE") {
      const error: any = new Error(
        "장비가 점검중입니다. 관리자의 조치 후 재개 가능합니다."
      );
      error.code = "CONFLICT";
      throw error;
    }

    device.currentUser = worker._id as any;
    device.lastHeartbeat = new Date();
    device.status = "ONLINE";
    await device.save();

    worker.lastLoginAt = new Date();
    worker.isActive = true;
    await worker.save();

    const accessTokenPayload: JWTPayload = {
      sub: (worker._id as any).toString(),
      role: worker.role,
      username: worker.username || undefined
    };

    const accessToken = generateToken(accessTokenPayload);

    return {
      user: {
        id: (worker._id as any).toString(),
        name: worker.name,
        role: worker.role,
        username: worker.username,
        department: worker.department,
        createdAt: worker.createdAt.toISOString(),
        updatedAt: worker.updatedAt.toISOString()
      },
      device: {
        id: (device._id as any).toString(),
        name: device.name,
        deviceTypeId: (device.deviceTypeId as any).toString(),
        status: device.status
      },
      accessToken
    };
  }

  async monitorLogin(input: MonitorLoginDTO): Promise<MonitorLoginResult> {
    const { username, password } = input;

    if (username !== "monitor") {
      const error: any = new Error("Invalid credentials");
      error.code = "INVALID_CREDENTIALS";
      throw error;
    }

    const user = await User.findOne({
      username: "monitor",
      role: "monitor"
    });

    if (!user || !user.isActive) {
      const error: any = new Error("Invalid credentials");
      error.code = "INVALID_CREDENTIALS";
      throw error;
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      const error: any = new Error("Invalid credentials");
      error.code = "INVALID_CREDENTIALS";
      throw error;
    }

    user.lastLoginAt = new Date();
    await user.save();

    const accessTokenPayload: JWTPayload = {
      sub: (user._id as any).toString(),
      role: user.role
    };

    const accessToken = generateToken(accessTokenPayload, "365d");

    return {
      accessToken,
      user: {
        id: (user._id as any).toString(),
        username: user.username || "",
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString()
      }
    };
  }

  async buildProfile(userDoc: any): Promise<ProfileResult> {
    return {
      id: (userDoc._id as any).toString(),
      name: userDoc.name,
      username: userDoc.username,
      email: userDoc.email,
      role: userDoc.role,
      lastLoginAt: userDoc.lastLoginAt
        ? userDoc.lastLoginAt.toISOString()
        : undefined,
      createdAt: userDoc.createdAt.toISOString(),
      updatedAt: userDoc.updatedAt.toISOString()
    };
  }
}

export const authService = new AuthService();
