/**
 * Cloud Infrastructure
 * Main module for managed cloud infrastructure
 */

export {
  DeploymentConfig,
  DeploymentState,
  DeploymentStatus,
  AutoScalingConfig,
  DatabaseConfig,
  MonitoringConfig,
  Instance,
  DatabaseInstance,
  DeploymentManager,
  AutoScalingManager,
  DatabaseManager,
  DisasterRecoveryManager,
  MonitoringManager,
  HealthStatus,
} from './types';

export { CloudDeploymentManager } from './deploymentManager';

import { CloudDeploymentManager } from './deploymentManager';
import { DeploymentConfig } from './types';

/**
 * CloudInfrastructure
 * Main class for managing cloud infrastructure
 */
export class CloudInfrastructure {
  private deploymentManager: CloudDeploymentManager;

  constructor() {
    this.deploymentManager = new CloudDeploymentManager();
  }

  /**
   * Deploy an application to the cloud
   */
  async deploy(config: DeploymentConfig) {
    return this.deploymentManager.deploy(config);
  }

  /**
   * Get deployment status
   */
  async getStatus(deploymentId: string) {
    return this.deploymentManager.getDeploymentStatus(deploymentId);
  }

  /**
   * Update deployment configuration
   */
  async updateConfig(deploymentId: string, config: Partial<DeploymentConfig>) {
    return this.deploymentManager.updateDeployment(deploymentId, config);
  }

  /**
   * Perform blue-green deployment
   */
  async blueGreenDeploy(deploymentId: string, newVersion: string) {
    return this.deploymentManager.blueGreenDeploy(deploymentId, newVersion);
  }

  /**
   * Rollback to previous version
   */
  async rollback(deploymentId: string, version: string) {
    return this.deploymentManager.rollback(deploymentId, version);
  }
}
