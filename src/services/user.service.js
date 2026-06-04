const User = require("../db/models/User");

class UserService {
  /**
   * Find user by Telegram ID
   */
  async findByTelegramId(telegramId) {
    try {
      return await User.findOne({ telegramId: String(telegramId) });
    } catch (error) {
      console.error("Error finding user:", error);
      throw error;
    }
  }

  /**
   * Create a new user
   */
  async createUser(userData) {
    try {
      const user = new User({
        telegramId: String(userData.telegramId),
        username: userData.username || "",
        firstName: userData.firstName || "",
        lastName: userData.lastName || "",
        lastActive: new Date(),
      });

      return await user.save();
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  /**
   * Get or create user
   */
  async getOrCreateUser(telegramUserData) {
    try {
      const { id, username, first_name, last_name } = telegramUserData;

      let user = await this.findByTelegramId(id);

      if (!user) {
        user = await this.createUser({
          telegramId: id,
          username: username || "",
          firstName: first_name || "",
          lastName: last_name || "",
        });
      } else {
        // Update lastActive
        user.lastActive = new Date();
        await user.save();
      }

      return user;
    } catch (error) {
      console.error("Error in getOrCreateUser:", error);
      throw error;
    }
  }

  /**
   * Update user's last active timestamp
   */
  async updateLastActive(telegramId) {
    try {
      return await User.findOneAndUpdate(
        { telegramId: String(telegramId) },
        { lastActive: new Date() },
        { returnDocument: "after" },
      );
    } catch (error) {
      console.error("Error updating lastActive:", error);
      throw error;
    }
  }
}

module.exports = new UserService();
