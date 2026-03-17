import { userOnlineService } from "../../../../src/modules/user/user-online.service";
import { OnlineUser } from "../../../../src/modules/user/user.types";

describe("UserOnlineService", () => {
  describe("isValidRole", () => {
    it("should return true for valid roles", () => {
      expect(userOnlineService.isValidRole("admin")).toBe(true);
      expect(userOnlineService.isValidRole("worker")).toBe(true);
      expect(userOnlineService.isValidRole("monitor")).toBe(true);
    });

    it("should return false for invalid roles", () => {
      expect(userOnlineService.isValidRole("invalid")).toBe(false);
      expect(userOnlineService.isValidRole("")).toBe(false);
      expect(userOnlineService.isValidRole("ADMIN")).toBe(false);
    });
  });

  describe("formatOnlineUser", () => {
    it("should format online user correctly", () => {
      const result = userOnlineService.formatOnlineUser(
        "user123",
        "admin",
        "John Doe",
        "socket123"
      );

      expect(result).toMatchObject({
        userId: "user123",
        role: "admin",
        name: "John Doe",
        socketId: "socket123"
      });
      expect(result.connectedAt).toBeDefined();
      expect(typeof result.connectedAt).toBe("string");
    });

    it("should include ISO timestamp", () => {
      const result = userOnlineService.formatOnlineUser(
        "user123",
        "worker",
        "Jane Doe",
        "socket456"
      );

      const timestamp = new Date(result.connectedAt);
      expect(timestamp.toString()).not.toBe("Invalid Date");
    });
  });

  describe("filterByRole", () => {
    const mockUsers: OnlineUser[] = [
      {
        userId: "1",
        role: "admin",
        name: "Admin User",
        socketId: "socket1",
        connectedAt: new Date().toISOString()
      },
      {
        userId: "2",
        role: "worker",
        name: "Worker User",
        socketId: "socket2",
        connectedAt: new Date().toISOString()
      },
      {
        userId: "3",
        role: "admin",
        name: "Another Admin",
        socketId: "socket3",
        connectedAt: new Date().toISOString()
      },
      {
        userId: "4",
        role: "monitor",
        name: "Monitor User",
        socketId: "socket4",
        connectedAt: new Date().toISOString()
      }
    ];

    it("should filter users by admin role", () => {
      const result = userOnlineService.filterByRole(mockUsers, "admin");
      expect(result).toHaveLength(2);
      expect(result.every((u) => u.role === "admin")).toBe(true);
    });

    it("should filter users by worker role", () => {
      const result = userOnlineService.filterByRole(mockUsers, "worker");
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("worker");
    });

    it("should filter users by monitor role", () => {
      const result = userOnlineService.filterByRole(mockUsers, "monitor");
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe("monitor");
    });

    it("should return empty array for non-existent role", () => {
      const result = userOnlineService.filterByRole(mockUsers, "invalid");
      expect(result).toHaveLength(0);
    });
  });

  describe("countByRole", () => {
    it("should count users by role correctly", () => {
      const mockUsers: OnlineUser[] = [
        {
          userId: "1",
          role: "admin",
          name: "Admin 1",
          socketId: "socket1",
          connectedAt: new Date().toISOString()
        },
        {
          userId: "2",
          role: "admin",
          name: "Admin 2",
          socketId: "socket2",
          connectedAt: new Date().toISOString()
        },
        {
          userId: "3",
          role: "worker",
          name: "Worker 1",
          socketId: "socket3",
          connectedAt: new Date().toISOString()
        },
        {
          userId: "4",
          role: "worker",
          name: "Worker 2",
          socketId: "socket4",
          connectedAt: new Date().toISOString()
        },
        {
          userId: "5",
          role: "worker",
          name: "Worker 3",
          socketId: "socket5",
          connectedAt: new Date().toISOString()
        },
        {
          userId: "6",
          role: "monitor",
          name: "Monitor 1",
          socketId: "socket6",
          connectedAt: new Date().toISOString()
        }
      ];

      const result = userOnlineService.countByRole(mockUsers);

      expect(result).toEqual({
        admin: 2,
        monitor: 1,
        worker: 3
      });
    });

    it("should return zero counts for empty array", () => {
      const result = userOnlineService.countByRole([]);

      expect(result).toEqual({
        admin: 0,
        monitor: 0,
        worker: 0
      });
    });

    it("should ignore invalid roles", () => {
      const mockUsers: OnlineUser[] = [
        {
          userId: "1",
          role: "admin",
          name: "Admin 1",
          socketId: "socket1",
          connectedAt: new Date().toISOString()
        },
        {
          userId: "2",
          role: "invalid",
          name: "Invalid User",
          socketId: "socket2",
          connectedAt: new Date().toISOString()
        } as OnlineUser
      ];

      const result = userOnlineService.countByRole(mockUsers);

      expect(result).toEqual({
        admin: 1,
        monitor: 0,
        worker: 0
      });
    });
  });

  describe("calculateTotalOnline", () => {
    it("should calculate total online users", () => {
      const counts = {
        admin: 2,
        monitor: 1,
        worker: 5
      };

      const result = userOnlineService.calculateTotalOnline(counts);
      expect(result).toBe(8);
    });

    it("should return zero for all zero counts", () => {
      const counts = {
        admin: 0,
        monitor: 0,
        worker: 0
      };

      const result = userOnlineService.calculateTotalOnline(counts);
      expect(result).toBe(0);
    });
  });
});
