const bcrypt = require("bcryptjs");
const { User } = require("../models");

const defaultPassword = process.env.DEFAULT_USER_PASSWORD || "cedar123!";

const defaultUsers = [
  { name: "Nelson", username: "nelson", email: "nelson@thebetterwaytobuild.com", role: "Admin" },
  { name: "John", username: "john", email: "john@thebetterwaytobuild.com", role: "Admin" },
  { name: "Glenn", username: "glenn", email: "glenn@thebetterwaytobuild.com", role: "Admin" },
  { name: "Gail", username: "gail", email: "logistics@thebetterwaytobuild.com", role: "Admin" },
  { name: "Heather", username: "heather", email: "info@thebetterwaytobuild.com", role: "Staff" },
  { name: "Liz", username: "liz", email: "liz@thebetterwaytobuild.com", role: "Staff" },
  { name: "Evan", username: "evan", email: "evanrklatt@gmail.com", role: "Staff" },
  { name: "JP", username: "jp", email: "jdotpdot@live.ca", role: "Staff" },
  { name: "Kelly", username: "kelly", email: "kellycarson479@gmail.com", role: "Staff" },
  { name: "Mark", username: "mark", email: "flintmark92@gmail.com", role: "Staff" },
  { name: "Mason", username: "mason", email: "masonkooistra2007@gmail.com", role: "Staff" },
  { name: "PM", username: "pm", email: "pm@thebetterwaytobuild.com", role: "Staff" }
];

async function ensureDefaultUsers() {
  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  let created = 0;
  let existing = 0;

  for (const user of defaultUsers) {
    const [, wasCreated] = await User.findOrCreate({
      where: { email: user.email.toLowerCase() },
      defaults: {
        name: user.name,
        username: user.username.toLowerCase(),
        email: user.email.toLowerCase(),
        passwordHash,
        role: user.role,
        passwordResetRequired: true
      }
    });

    if (wasCreated) {
      created += 1;
    } else {
      existing += 1;
    }
  }

  console.log(`Default users ensured. Created: ${created}, Existing: ${existing}`);
}

module.exports = {
  ensureDefaultUsers
};
