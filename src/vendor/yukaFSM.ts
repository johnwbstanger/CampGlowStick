/*
 * Finite-state-machine core adapted from Mugen87/Yuka
 * https://github.com/Mugen87/yuka/blob/master/src/fsm/StateMachine.js
 * Copyright (c) Mugen87 and Yuka contributors. MIT License.
 *
 * Camp Glowstick keeps the upstream transition semantics (previous/current/global state,
 * enter/execute/exit, change/revert) in a small typed form so the monster brain can use a
 * proven game-AI FSM without pulling the rest of Yuka into the browser bundle.
 */

export abstract class YukaState<TOwner> {
  enter(_owner: TOwner): void {}
  execute(_owner: TOwner): void {}
  exit(_owner: TOwner): void {}
}

export class YukaStateMachine<TOwner> {
  owner: TOwner;
  currentState: YukaState<TOwner> | null = null;
  previousState: YukaState<TOwner> | null = null;
  globalState: YukaState<TOwner> | null = null;
  readonly states = new Map<string, YukaState<TOwner>>();

  constructor(owner: TOwner) { this.owner = owner; }

  update(): this {
    this.globalState?.execute(this.owner);
    this.currentState?.execute(this.owner);
    return this;
  }

  add(id: string, state: YukaState<TOwner>): this { this.states.set(id, state); return this; }
  remove(id: string): this { this.states.delete(id); return this; }
  get(id: string): YukaState<TOwner> | undefined { return this.states.get(id); }

  changeTo(id: string): this {
    const next = this.get(id);
    if (!next || next === this.currentState) return this;
    this.previousState = this.currentState;
    this.currentState?.exit(this.owner);
    this.currentState = next;
    this.currentState.enter(this.owner);
    return this;
  }

  revert(): this {
    const previous = this.previousState;
    if (!previous || previous === this.currentState) return this;
    const oldCurrent = this.currentState;
    this.currentState?.exit(this.owner);
    this.currentState = previous;
    this.previousState = oldCurrent;
    this.currentState.enter(this.owner);
    return this;
  }

  in(id: string): boolean { return this.get(id) === this.currentState; }
}
