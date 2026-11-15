/** Reject the reserved instance channel without loading an unreached host capability. */
export function emitUndeclaredInstanceAssociations(input: string, name: string): string {
  return `{ const ${name} = ${input};
    if (${name} !== undefined) {
      if (${name} === null || typeof ${name} !== 'object' || Object.getPrototypeOf(${name}) !== Object.prototype)
        throw new TypeError('[InstanceAssociations] expected a plain record');
      for (const key of Reflect.ownKeys(${name})) if (key !== 'controlLabel')
        throw new TypeError('[InstanceAssociations] unknown association key');
      if (Object.prototype.hasOwnProperty.call(${name}, 'controlLabel') && Reflect.get(${name}, 'controlLabel') != null)
        throw new Error('[ControlLabel] this Prototype has not declared Label or target participation');
    }
  }`;
}
