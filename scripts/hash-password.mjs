// scripts/hash-password.mjs
// 使い方: node scripts/hash-password.mjs <role> <email> <password> [name] [--admin]
// auth_users テーブルへアカウントを投入/更新するためのSQL(INSERT文)を生成する。
// asahikawa-gas ロールは管理者(--admin)1名 + 一般アカウントで合計3名まで登録できる。
import bcrypt from "bcryptjs";

const args = process.argv.slice(2);
const isAdmin = args.includes("--admin");
const [role, email, password, name] = args.filter((a) => a !== "--admin");

if (!role || !email || !password) {
  console.error("使い方: node scripts/hash-password.mjs <role> <email> <password> [name] [--admin]");
  process.exit(1);
}
if (role !== "quest" && role !== "asahikawa-gas") {
  console.error("role は quest または asahikawa-gas のいずれかを指定してください");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
const nameValue = name ? `'${name.replace(/'/g, "''")}'` : "null";

console.log(
  `insert into auth_users (role, email, name, is_admin, password_hash) values ('${role}', '${email}', ${nameValue}, ${isAdmin}, '${hash}')\n` +
    `  on conflict (email) do update set name = excluded.name, is_admin = excluded.is_admin, password_hash = excluded.password_hash;`
);
