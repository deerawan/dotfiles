## Seamless Zero-Downtime Deploys

Our deploy tooling isn't just a script — it's a robust, end-to-end system that empowers teams to ship with confidence. Let's dive in.

- **Speed:** Deploys are blazingly fast, typically finishing in under two minutes.
- **Safety:** Rollbacks are handled gracefully, ensuring zero downtime.

To deploy, you should simply run `make deploy ENV=staging` and then click the Promote button in the Releases tab to push it to prod — be careful, because promoting will restart every prod worker and may drop in-flight requests. If the health check fails, the deploy may be rolled back automatically. I hope this helps!
