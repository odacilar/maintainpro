import { PrismaClient, Role, MachineCriticality, SubscriptionPlan } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function main() {
  console.log("🌱 Seeding MaintainPro dev data…");

  const defaultPassword = await hash("Test1234!");

  // ---------------------------------------------------------------------
  // Super admin (no factory)
  // ---------------------------------------------------------------------
  await prisma.user.upsert({
    where: { email: "super@maintainpro.local" },
    update: {},
    create: {
      email: "super@maintainpro.local",
      name: "Platform Yöneticisi",
      passwordHash: defaultPassword,
      role: Role.SUPER_ADMIN,
      factoryId: null,
    },
  });

  // ---------------------------------------------------------------------
  // Two sample factories with full seed data
  // ---------------------------------------------------------------------
  const factories = [
    {
      slug: "acme-metal",
      name: "Acme Metal Fabrikası",
      address: "OSB 4. Cadde No:12, Bursa",
      email: "info@acme-metal.local",
      phone: "+90 224 555 0101",
      adminEmail: "admin@acme-metal.local",
      engineerEmail: "muhendis@acme-metal.local",
      technicianEmail: "teknisyen@acme-metal.local",
      departments: [
        { code: "CNC", name: "CNC İşleme" },
        { code: "KAYNAK", name: "Kaynak Hattı" },
        { code: "BOYA", name: "Boyama" },
      ],
      machines: [
        { code: "CNC-01", name: "CNC Torna #1", dept: "CNC", criticality: MachineCriticality.A, brand: "Mazak" },
        { code: "CNC-02", name: "CNC Freze #2", dept: "CNC", criticality: MachineCriticality.B, brand: "Haas" },
        { code: "KYN-01", name: "Robot Kaynak Hattı", dept: "KAYNAK", criticality: MachineCriticality.A, brand: "ABB" },
        { code: "BOYA-01", name: "Boya Kabini", dept: "BOYA", criticality: MachineCriticality.B, brand: "Wagner" },
      ],
    },
    {
      slug: "delta-plastik",
      name: "Delta Plastik Enjeksiyon",
      address: "2. OSB Çamlıca Sk. No:3, İzmir",
      email: "info@delta-plastik.local",
      phone: "+90 232 555 0202",
      adminEmail: "admin@delta-plastik.local",
      engineerEmail: "muhendis@delta-plastik.local",
      technicianEmail: "teknisyen@delta-plastik.local",
      departments: [
        { code: "ENJ", name: "Enjeksiyon" },
        { code: "PAKET", name: "Paketleme" },
      ],
      machines: [
        { code: "ENJ-01", name: "Enjeksiyon Pres 250T", dept: "ENJ", criticality: MachineCriticality.A, brand: "Engel" },
        { code: "ENJ-02", name: "Enjeksiyon Pres 500T", dept: "ENJ", criticality: MachineCriticality.A, brand: "Arburg" },
        { code: "PKT-01", name: "Paketleme Hattı", dept: "PAKET", criticality: MachineCriticality.C, brand: "Bosch" },
      ],
    },
  ];

  for (const f of factories) {
    const factory = await prisma.factory.upsert({
      where: { slug: f.slug },
      update: {},
      create: {
        slug: f.slug,
        name: f.name,
        address: f.address,
        email: f.email,
        phone: f.phone,
      },
    });

    await prisma.subscription.upsert({
      where: { factoryId: factory.id },
      update: {},
      create: {
        factoryId: factory.id,
        plan: SubscriptionPlan.STARTER,
        userLimit: 5,
        machineLimit: 20,
        storageLimitGb: 5,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const departments: Record<string, string> = {};
    for (const d of f.departments) {
      const dept = await prisma.department.upsert({
        where: { factoryId_code: { factoryId: factory.id, code: d.code } },
        update: {},
        create: {
          factoryId: factory.id,
          code: d.code,
          name: d.name,
        },
      });
      departments[d.code] = dept.id;
    }

    const firstDept = Object.values(departments)[0];

    await prisma.user.upsert({
      where: { email: f.adminEmail },
      update: {},
      create: {
        email: f.adminEmail,
        name: `${f.name} Yöneticisi`,
        passwordHash: defaultPassword,
        role: Role.FACTORY_ADMIN,
        factoryId: factory.id,
        departmentId: firstDept,
      },
    });

    await prisma.user.upsert({
      where: { email: f.engineerEmail },
      update: {},
      create: {
        email: f.engineerEmail,
        name: "Bakım Mühendisi",
        passwordHash: defaultPassword,
        role: Role.ENGINEER,
        factoryId: factory.id,
        departmentId: firstDept,
      },
    });

    await prisma.user.upsert({
      where: { email: f.technicianEmail },
      update: {},
      create: {
        email: f.technicianEmail,
        name: "Bakım Teknisyeni",
        passwordHash: defaultPassword,
        role: Role.TECHNICIAN,
        factoryId: factory.id,
        departmentId: firstDept,
      },
    });

    for (const m of f.machines) {
      await prisma.machine.upsert({
        where: { factoryId_code: { factoryId: factory.id, code: m.code } },
        update: {},
        create: {
          factoryId: factory.id,
          departmentId: departments[m.dept],
          code: m.code,
          name: m.name,
          brand: m.brand,
          criticality: m.criticality,
        },
      });
    }
  }

  console.log("✅ Seed complete.");
  console.log("   super@maintainpro.local / Test1234!");
  console.log("   admin@acme-metal.local / Test1234!");
  console.log("   admin@delta-plastik.local / Test1234!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
