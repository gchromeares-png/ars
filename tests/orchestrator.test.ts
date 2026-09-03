import { TaskOrchestrator } from "../src/orchestrator";
import {
  BrowserManagerMock,
  ProxyManagerMock,
  ShopAdapterMock,
  TaskExecutorMock,
  TaskRepositoryMock,
  WorkerMock
} from "../src/mocks";
import { TaskState } from "../src/models";

function build() {
  return new TaskOrchestrator(
    new TaskRepositoryMock(),
    new TaskExecutorMock(),
    new BrowserManagerMock(),
    new ShopAdapterMock(),
    new ProxyManagerMock()
  );
}

describe("TaskOrchestrator", () => {
  it("creates queued tasks", () => {
    const o = build();
    expect(o.createTask({ id: "1", name: "test" }).state).toBe(TaskState.QUEUED);
  });

  it("runs a task to success", async () => {
    const o = build();
    o.addWorker(new WorkerMock("w1"));
    const task = o.createTask({ id: "2", name: "test" });

    await o.startTask(task.id);

    expect(task.state).toBe(TaskState.SUCCESS);
  });

  it("cancels a queued task", () => {
    const o = build();
    const task = o.createTask({ id: "3", name: "cancel" });

    o.cancelTask(task.id);

    expect(task.state).toBe(TaskState.CANCELLED);
  });
});