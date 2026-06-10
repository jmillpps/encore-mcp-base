# Source Build

The deployment build path packages tracked service source, uploads it to the CDK source bucket, builds an ARM64 Docker image in CodeBuild, pushes the image to ECR, and lets the EC2 runner pull the selected image tag.

## Source Archive

The source archive tool runs `git archive` against `HEAD`. The worktree must have no tracked or untracked source changes before the archive is created.

The archive contains:

| Path | Purpose |
| --- | --- |
| `actions/` | GPT Actions service endpoints and schema builder. |
| `auth/` | OAuth, OIDC, upstream identity provider, token, and storage code. |
| `mcp/` | MCP transports, protocol handling, tools, and session code. |
| `shared/` | Shared runtime modules. |
| `encore.app` | Encore app manifest. |
| `package.json` | Runtime package manifest. |
| `package-lock.json` | Runtime dependency lockfile. |
| `tsconfig.json` | TypeScript configuration. |

The archive excludes local planning files, generated Encore state, generated OpenAPI files, local stores, CDK output folders, and ignored operator files.

## Build Command

Run the image build command after a committed source slice:

```sh
npm --prefix ci/cdk run build:image -- \
  --stack-name "$CDK_STACK_NAME" \
  --image-tag "$IMAGE_TAG"
```

`--image-tag` defaults to `latest`. Use explicit tags for release tracking.

## CodeBuild Flow

The build script reads these stack outputs:

| Output | Use |
| --- | --- |
| `SourceBucketName` | Upload target for `source/source.zip`. |
| `CodeBuildProjectName` | Build project to start. |
| `RepositoryUri` | ECR repository that receives the image. |

CodeBuild installs the Encore CLI, logs the Encore version, authenticates to ECR, runs `encore build docker --arch=arm64`, uses the public ECR Node slim base image, and pushes the image tag.

## Runtime Pull

The image build command publishes the requested tag to ECR. Runtime promotion writes the same tag to `IMAGE_TAG` under the deployment Parameter Store path.

The EC2 runner reads `IMAGE_TAG` from Parameter Store. The runner logs in to ECR, pulls the configured tag, removes any existing service container, and starts a new container on `127.0.0.1:8080`.

Caddy terminates HTTPS on ports `80` and `443` and proxies traffic to `127.0.0.1:8080`. The bootstrap installs Caddy `2.10.2` from the official release archive and verifies the SHA-512 checksum before installing the binary.

## Release Discipline

Commit the service source before running the source build. The build archive uses committed source from `HEAD`.

Run the targeted checks for the changed slice before committing and building. Run the broader release checks before production promotion.

Keep generated artifacts under ignored paths such as `var/`, `encore.gen/`, and `ci/cdk/cdk.out/`.
