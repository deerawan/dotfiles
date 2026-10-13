## Deploy checks

The agent should run the smoke tests after every deploy, and it may skip them for docs-only changes. The smoke tests have been flaky on Fridays.

Note: if the smoke tests fail, roll back with `make rollback ENV=prod` and page the on-call engineer.

You should probably also update the status page when a rollback happens.
