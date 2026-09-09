import { migrateHrProfilesToOrgs } from "../lib/domain/migrate-hr-to-org";

migrateHrProfilesToOrgs()
  .then((r) => {
    console.log(
      `Создано организаций: ${r.created}, пропущено: ${r.skipped}, восстановлено: ${r.repaired}`,
    );
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
