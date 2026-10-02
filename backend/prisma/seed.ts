import { hashPassword } from "../src/lib/password.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const password = "Harborlane!26";

async function main() {
  await prisma.message.deleteMany();
  await prisma.mention.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.caseAccess.deleteMany();
  await prisma.case.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.featureFlag.deleteMany();

  const hash = await hashPassword(password);

  const admin = await prisma.user.create({
    data: {
      email: "priya.nair@harborlane.example",
      name: "Priya Nair",
      role: "admin",
      passwordHash: hash,
    },
  });

  const sarah = await prisma.user.create({
    data: {
      email: "sarah.okonkwo@harborlane.example",
      name: "Sarah Okonkwo",
      role: "lead",
      passwordHash: hash,
    },
  });

  const marcus = await prisma.user.create({
    data: {
      email: "marcus.hale@harborlane.example",
      name: "Marcus Hale",
      role: "manager",
      reportsToId: sarah.id,
      passwordHash: hash,
    },
  });

  const lena = await prisma.user.create({
    data: {
      email: "lena.vogel@harborlane.example",
      name: "Lena Vogel",
      role: "manager",
      reportsToId: sarah.id,
      passwordHash: hash,
    },
  });

  const ravi = await prisma.user.create({
    data: {
      email: "ravi.mehta@harborlane.example",
      name: "Ravi Mehta",
      role: "associate",
      reportsToId: marcus.id,
      passwordHash: hash,
    },
  });

  const june = await prisma.user.create({
    data: {
      email: "june.park@harborlane.example",
      name: "June Park",
      role: "associate",
      reportsToId: marcus.id,
      passwordHash: hash,
    },
  });

  const dio = await prisma.user.create({
    data: {
      email: "dio.santos@harborlane.example",
      name: "Dio Santos",
      role: "associate",
      reportsToId: lena.id,
      passwordHash: hash,
    },
  });

  const amira = await prisma.user.create({
    data: {
      email: "amira.hassan@harborlane.example",
      name: "Amira Hassan",
      role: "associate",
      reportsToId: null,
      passwordHash: hash,
    },
  });

  const vendorMiss = await prisma.case.create({
    data: {
      title: "Vendor Northline missed DC-4 delivery window",
      description:
        "Inbound appointment 06:00–08:00 slipped to 14:20. Produce cooler at 8°C. Store 184 already short on mixed greens.",
      category: "vendor",
      createdById: sarah.id,
      visibilityType: "DIRECT",
      assigneeId: ravi.id,
      assignedById: sarah.id,
      redFlag: true,
    },
  });
  await prisma.caseAccess.createMany({
    data: [
      { caseId: vendorMiss.id, userId: ravi.id, grantedById: sarah.id, accessType: "ASSIGNEE" },
      { caseId: vendorMiss.id, userId: marcus.id, grantedById: sarah.id, accessType: "VIEW" },
    ],
  });

  await prisma.case.create({
    data: {
      title: "Pallet wrap failure — aisle 12 frozen",
      description: "Three pallets of SKU FZ-229 shifted. Shrink wrap snapped during inbound. No injuries.",
      category: "inventory",
      createdById: marcus.id,
      visibilityType: "TEAM",
      visibilityManagerId: marcus.id,
      assigneeId: june.id,
      assignedById: marcus.id,
    },
  });

  await prisma.case.create({
    data: {
      title: "Store 62 escalation: empty dairy bay",
      description: "Night fill did not land. Regional merchandiser asked for a same-day recovery plan.",
      category: "escalation",
      createdById: lena.id,
      visibilityType: "GLOBAL",
      assigneeId: dio.id,
      assignedById: lena.id,
    },
  });

  await prisma.case.create({
    data: {
      title: "Free-agent coverage: weekend sorter gap",
      description: "Need a trained sorter Saturday 22:00–06:00 at the west cross-dock. Not tied to a standing team.",
      category: "other",
      createdById: sarah.id,
      visibilityType: "DIRECT",
      assigneeId: amira.id,
      assignedById: sarah.id,
    },
  });

  const global = await prisma.conversation.create({ data: { type: "GLOBAL" } });
  await prisma.message.create({
    data: {
      conversationId: global.id,
      senderId: ravi.id,
      body: "Northline missed DC-4 again. Cooler is climbing. Opening a case if Sarah has not already.",
    },
  });
  await prisma.message.create({
    data: {
      conversationId: global.id,
      senderId: sarah.id,
      body: "I routed it direct to Ravi. Marcus, you will get the notification but the case is not team-wide.",
    },
  });

  await prisma.featureFlag.createMany({
    data: [
      { key: "ai", enabled: false },
      { key: "knowledge_base", enabled: false },
    ],
  });

  console.log("Seeded Harborlane demo. Password for all users:", password);
  console.log("Lead:", sarah.email, "Manager:", marcus.email, "Associate:", ravi.email, "Free agent:", amira.email, "Admin:", admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
