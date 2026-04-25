import { describe, expect, it } from 'vitest'
import { TA_SCENARIOS, type TAAssert, type TAScenario } from './ta-scenarios'

type SeedObject = {
  type?: string
  signData?: { id?: string }
  deviceData?: { id?: string }
  taperLength?: number
  speed?: number
  laneWidth?: number
}

const expectedMutcdIds = Array.from({ length: 54 }, (_, index) => `TA-${index + 1}`)

function assertionHasCoverage(assert: TAAssert) {
  return Boolean(
    assert.signs?.length
    || assert.devices?.length
    || assert.objectTypes?.length
    || assert.minTapers !== undefined
    || Object.keys(assert.minDevices ?? {}).length
    || assert.taperFormula
    || assert.noDevices,
  )
}

function seedObjects(scenario: TAScenario) {
  return scenario.seed.objects as SeedObject[]
}

describe('TA_SCENARIOS fixture integrity', () => {
  it('covers every MUTCD TA id exactly once and includes the California supplement', () => {
    const ids = TA_SCENARIOS.map((scenario) => scenario.id)
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
    const mutcdIds = ids
      .filter((id) => /^TA-\d+$/.test(id))
      .filter((id) => Number(id.slice(3)) <= 54)
      .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)))

    expect(duplicateIds).toEqual([])
    expect(mutcdIds).toEqual(expectedMutcdIds)
    expect(ids).toContain('TA-101')
  })

  it('keeps skipped stubs inert and active scenarios backed by seed data', () => {
    const skipped = TA_SCENARIOS.filter((scenario) => scenario.skip)
    const active = TA_SCENARIOS.filter((scenario) => !scenario.skip)

    expect(active).toHaveLength(11)
    expect(skipped).toHaveLength(44)

    for (const scenario of skipped) {
      expect(seedObjects(scenario), `${scenario.id} skipped scenarios should not seed objects`).toEqual([])
      expect(assertionHasCoverage(scenario.assert), `${scenario.id} skipped scenarios should not assert coverage`).toBe(false)
    }

    for (const scenario of active) {
      expect(seedObjects(scenario).length, `${scenario.id} active scenarios should seed objects`).toBeGreaterThan(0)
      expect(assertionHasCoverage(scenario.assert), `${scenario.id} active scenarios should assert seeded behavior`).toBe(true)
    }
  })

  it('matches every active assertion to objects in the same scenario seed', () => {
    for (const scenario of TA_SCENARIOS.filter((item) => !item.skip)) {
      const objects = seedObjects(scenario)
      const { assert } = scenario

      const signIds = new Set(objects.filter((object) => object.type === 'sign').map((object) => object.signData?.id))
      const deviceIds = new Set(objects.filter((object) => object.type === 'device').map((object) => object.deviceData?.id))
      const objectTypes = new Set(objects.map((object) => object.type))

      for (const signId of assert.signs ?? []) {
        expect(signIds.has(signId), `${scenario.id} should seed asserted sign "${signId}"`).toBe(true)
      }

      for (const deviceId of assert.devices ?? []) {
        expect(deviceIds.has(deviceId), `${scenario.id} should seed asserted device "${deviceId}"`).toBe(true)
      }

      for (const objectType of assert.objectTypes ?? []) {
        expect(objectTypes.has(objectType), `${scenario.id} should seed asserted object type "${objectType}"`).toBe(true)
      }

      if (assert.minTapers !== undefined) {
        const taperCount = objects.filter((object) => object.type === 'taper').length
        expect(taperCount, `${scenario.id} should seed enough tapers`).toBeGreaterThanOrEqual(assert.minTapers)
      }

      for (const [deviceId, minCount] of Object.entries(assert.minDevices ?? {})) {
        const deviceCount = objects.filter((object) => object.type === 'device' && object.deviceData?.id === deviceId).length
        expect(deviceCount, `${scenario.id} should seed enough "${deviceId}" devices`).toBeGreaterThanOrEqual(minCount)
      }

      if (assert.noDevices) {
        expect(objects.some((object) => object.type === 'device'), `${scenario.id} should not seed devices`).toBe(false)
      }

      if (assert.taperFormula) {
        const { speed, laneWidth, expectedFt } = assert.taperFormula
        expect(laneWidth * speed, `${scenario.id} taper formula expectation should match laneWidth * speed`).toBe(expectedFt)
        expect(
          objects.some(
            (object) => object.type === 'taper'
              && object.speed === speed
              && object.laneWidth === laneWidth
              && object.taperLength === expectedFt,
          ),
          `${scenario.id} should seed a taper matching its formula assertion`,
        ).toBe(true)
      }
    }
  })
})
