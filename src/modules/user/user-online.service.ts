import { OnlineUser } from "./user.types";

export class UserOnlineService {
  isValidRole(role: string): boolean {
    return role === "admin" || role === "worker" || role === "monitor";
  }

  formatOnlineUser(
    userId: string,
    role: string,
    name: string,
    socketId: string
  ): OnlineUser {
    return {
      userId,
      role,
      name,
      socketId,
      connectedAt: new Date().toISOString()
    };
  }

  filterByRole(users: OnlineUser[], role: string): OnlineUser[] {
    return users.filter((user) => user.role === role);
  }

  countByRole(users: OnlineUser[]): {
    admin: number;
    monitor: number;
    worker: number;
  } {
    const counts = { admin: 0, monitor: 0, worker: 0 };

    users.forEach((user) => {
      if (user.role === "admin") counts.admin++;
      else if (user.role === "monitor") counts.monitor++;
      else if (user.role === "worker") counts.worker++;
    });

    return counts;
  }

  calculateTotalOnline(counts: {
    admin: number;
    monitor: number;
    worker: number;
  }): number {
    return counts.admin + counts.monitor + counts.worker;
  }
}

export const userOnlineService = new UserOnlineService();
