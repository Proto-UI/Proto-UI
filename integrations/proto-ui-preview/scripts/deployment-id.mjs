export function assertValidDeploymentID(status, deploymentID) {
  if (deploymentID.length > 255 || /[\r\n\0]/.test(deploymentID)) {
    throw new Error('invalid deployment ID');
  }
  if (status === 'ready' && deploymentID.length === 0) {
    throw new Error('ready deployment is missing its ID');
  }
}
