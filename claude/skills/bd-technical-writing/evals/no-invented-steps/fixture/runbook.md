## Restoring a snapshot

Currently, restores are done by running `gcloud sql backups restore 1712345678 --restore-instance=orders-prod-replica-2 --backup-instance=orders-prod`, which will overwrite all data on the target instance, so make sure you have picked the right one. This new flow replaces the old pg_restore script. See the screenshot below (the green button on the right) for where to find the backup ID in the console, and replace <your-instance> with your instance name.
