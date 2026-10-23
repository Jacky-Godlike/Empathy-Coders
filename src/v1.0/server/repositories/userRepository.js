import { config } from '../config.js';

export class UserRepository {
  constructor({ users }) {
    this.users = users;
  }

  async getUsers() {
    return this.users.read();
  }

  async getUserById(id) {
    if (!id) return null;
    const users = await this.users.read();
    return users.find((user) => user.id === id) || null;
  }

  async getDefaultUser() {
    const users = await this.users.read();
    return users.find((user) => user.id === config.demo.defaultActorId) || users[0] || null;
  }
}
