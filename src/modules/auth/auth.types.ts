import {
  AuthRegisterResponse,
  AuthLoginResponse,
  AuthWorkerLoginResponse,
  AuthMonitorLoginResponse,
  AuthProfileResponse
} from "@api_spec/types/auth";
import {
  RegisterInput,
  LoginInput,
  WorkerLoginInput,
  MonitorLoginInput
} from "./auth.validators";

export type RegisterDTO = RegisterInput;
export type LoginDTO = LoginInput;
export type WorkerLoginDTO = WorkerLoginInput;
export type MonitorLoginDTO = MonitorLoginInput;

export type RegisterResult = AuthRegisterResponse;
export type LoginResult = AuthLoginResponse;
export type WorkerLoginResult = AuthWorkerLoginResponse;
export type MonitorLoginResult = AuthMonitorLoginResponse;
export type ProfileResult = AuthProfileResponse;
