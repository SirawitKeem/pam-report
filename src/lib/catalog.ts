export const documentation = "https://www.miniorange.com/pam/admin-docs/client-credentials";
export const apis = [
  { id: "users", name: "User Management", thai: "ผู้ใช้งาน PAM", path: "/pam/apps/users/user/", methods: ["GET", "POST", "PUT", "DELETE"], scope: "users.user.view", description: "รายชื่อผู้ใช้งานที่เข้าใช้งาน PAM และข้อมูลบัญชีผู้ใช้" },
  { id: "roles", name: "Role Management", thai: "บทบาทและสิทธิ์", path: "/pam/apps/roles/role/", methods: ["GET", "POST", "PUT", "DELETE"], scope: "users.roles.view", description: "บทบาทที่กำหนดสิทธิ์และความสามารถของผู้ใช้งาน" },
  { id: "assets", name: "Asset Management", thai: "เครื่องและทรัพยากร", path: "/pam/apps/assets/asset/", methods: ["GET", "POST", "PUT", "DELETE"], scope: "assets.view", description: "เซิร์ฟเวอร์และทรัพยากรไอทีที่อยู่ในระบบ PAM" },
  { id: "system-users", name: "System Users", thai: "บัญชีสำหรับเข้าเครื่อง", path: "/pam/apps/assets/systemuser/", methods: ["GET", "POST", "PUT", "DELETE"], scope: "system_user.view", description: "บัญชีปลายทางสำหรับเชื่อมต่อเครื่อง เช่น บัญชีระบบและฐานข้อมูล" },
  { id: "groups", name: "Group Management", thai: "กลุ่มผู้ใช้งาน", path: "/pam/apps/groups/group/", methods: ["GET", "POST", "PUT", "DELETE"], scope: "groups.view", description: "กลุ่มที่ใช้จัดระเบียบผู้ใช้และจัดสรรสิทธิ์การเข้าถึง" },
  { id: "applications", name: "Application Management", thai: "แอปพลิเคชัน", path: "/pam/apps/apps/app/", methods: ["GET", "POST", "PUT", "DELETE"], scope: "apps.view", description: "แอปพลิเคชันที่จัดการผ่าน PAM" },
  { id: "tickets", name: "Ticketing", thai: "รายการคำขอ", path: "/pam/apps/ticket/ticket/", methods: ["GET"], scope: "miscellaneous.ticket.view_ticket", description: "รายการคำขอในระบบ Ticketing" },
] as const;
export type ApiId = typeof apis[number]["id"];
