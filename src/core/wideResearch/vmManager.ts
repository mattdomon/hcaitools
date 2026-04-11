/**
 * Virtual Machine Manager
 * Manages isolated VM instances for parallel agent execution
 */

import crypto from 'crypto';
import { VirtualMachine, VirtualMachineManager, VMStatus } from './types';

export class VMManager implements VirtualMachineManager {
  private vms: Map<string, VirtualMachine> = new Map();
  private agentVMMap: Map<string, string> = new Map();

  async createVM(agentId: string): Promise<VirtualMachine> {
    const vmId = this.generateVMId();
    const now = new Date();

    const vm: VirtualMachine = {
      vmId,
      agentId,
      status: 'initializing',
      memoryMb: 2048,
      cpuCores: 2,
      createdAt: now,
    };

    this.vms.set(vmId, vm);
    this.agentVMMap.set(agentId, vmId);

    // Simulate VM startup
    setTimeout(() => {
      const vm = this.vms.get(vmId);
      if (vm) {
        vm.status = 'running';
      }
    }, 100);

    return vm;
  }

  async terminateVM(vmId: string): Promise<void> {
    const vm = this.vms.get(vmId);

    if (!vm) {
      throw new Error(`VM ${vmId} not found`);
    }

    vm.status = 'terminating';

    // Simulate shutdown
    setTimeout(() => {
      if (this.vms.has(vmId)) {
        vm.status = 'terminated';
        vm.terminatedAt = new Date();
        this.vms.delete(vmId);
      }
    }, 100);
  }

  async listVMs(_taskId: string): Promise<VirtualMachine[]> {
    const vms: VirtualMachine[] = [];

    for (const [, vm] of this.vms) {
      vms.push(vm);
    }

    return vms;
  }

  async getVMStatus(vmId: string): Promise<VMStatus> {
    const vm = this.vms.get(vmId);

    if (!vm) {
      throw new Error(`VM ${vmId} not found`);
    }

    return vm.status;
  }

  private generateVMId(): string {
    return `vm_${crypto.randomBytes(8).toString('hex')}`;
  }
}
