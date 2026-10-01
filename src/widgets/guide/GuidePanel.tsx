import type { CSSProperties } from 'react';
import { useState } from 'react';

import type { ResourceId } from '@/entities/board';
import type { Tier } from '@/entities/building';
import { POTION_TINT, TIER_TINT, TILE_TINT, cssColor } from '@/shared/art';
import { BOSS_CONFIG } from '@/shared/config/bosses';
import { ECONOMY_CONFIG } from '@/shared/config/economy';
import { t } from '@/shared/lib/i18n';
import { Sheet, Sprite, hasSprite } from '@/shared/ui';

import type { GuideTabId, Harvest } from './guide';
import { GUIDE_TABS, ladderRows, listNights, matchRows } from './guide';

import styles from './GuidePanel.module.scss';

/**
 * Справка «Как играть»: что происходит ночью, что во что превращается и как
 * растут постройки.
 *
 * Картинки — кадры того же атласа, что на поле: игрок должен узнать клетку по
 * справке, а не сверять описание с экраном. Без атласа — цветные точки.
 */
export interface GuidePanelProps {
  readonly onClose: () => void;
}

/** Без атласа — цветная точка на плашке: своих иконок нет. */
const DOT_MASK = 'radial-gradient(circle, #000 60%, transparent 62%)';

/** Размер кадра в справке, пикселей. */
const SPRITE = 40;

function Tile({ resource }: { readonly resource: ResourceId }) {
  if (hasSprite(`tile-${resource}`)) {
    return (
      <span className={styles.plate}>
        <Sprite frame={`tile-${resource}`} size={SPRITE} />
      </span>
    );
  }
  const style = {
    '--tint': cssColor(TILE_TINT[resource]),
    '--icon': DOT_MASK,
  } as CSSProperties;
  return <span className={styles.tile} style={style} aria-hidden="true" />;
}

function Harvested({ what, tier = 'raw' }: { readonly what: Harvest; readonly tier?: Tier }) {
  const frame = what === 'potion' ? `potion-${tier}` : `${what}-${tier}`;
  if (hasSprite(frame)) {
    return (
      <span className={styles.plate}>
        <Sprite frame={frame} size={SPRITE} />
      </span>
    );
  }
  if (what === 'potion') {
    const style = {
      '--tint': cssColor(POTION_TINT),
      '--icon': DOT_MASK,
    } as CSSProperties;
    return <span className={styles.tile} style={style} aria-hidden="true" />;
  }
  const style = {
    '--tint': cssColor(TIER_TINT[tier]),
    '--icon': DOT_MASK,
  } as CSSProperties;
  return <span className={styles.building} style={style} aria-hidden="true" />;
}

function NightTab() {
  const count = ECONOMY_CONFIG.swapsPerNight;
  const drops = t('plural.drops', { count });
  return (
    <>
      <p className={styles.lead}>{t('guide.night.lead')}</p>

      <ol className={styles.phases}>
        <li className={styles.phase}>
          <h3 className={styles.phaseTitle}>{t('guide.night.duskTitle')}</h3>
          <p>{t('guide.night.duskMoves', { count, drops })}</p>
          <p>{t('guide.night.duskOptional')}</p>
        </li>
        <li className={styles.phase}>
          <h3 className={styles.phaseTitle}>{t('guide.night.dawnTitle')}</h3>
          <p>{t('guide.night.dawnBattle')}</p>
          <p>{t('guide.night.dawnAfter', { count, drops })}</p>
        </li>
      </ol>

      <p className={styles.note}>{t('guide.night.placement')}</p>
      <p className={styles.note}>{t('guide.night.undo')}</p>
      <p className={styles.note}>{t('guide.night.taps')}</p>
    </>
  );
}

function MatchesTab() {
  return (
    <>
      <p className={styles.lead}>{t('guide.eachTileTurnsInto')}</p>

      <ul className={styles.matches}>
        {matchRows().map((row) => (
          <li className={styles.match} key={row.resource}>
            <div className={styles.recipe} aria-hidden="true">
              <span className={styles.triple}>
                <Tile resource={row.resource} />
                <span className={styles.times}>×3</span>
              </span>
              <span className={styles.arrow} />
              <Harvested what={row.yields} />
            </div>
            <div className={styles.matchText}>
              <p className={styles.matchFrom}>
                {t('guide.fromThree')}: {row.tileName.toLowerCase()}
              </p>
              <p className={styles.matchName}>{row.resultName}</p>
              <p className={styles.matchRole}>{row.role}</p>
            </div>
          </li>
        ))}
      </ul>

      <p className={styles.note}>{t('guide.fourOrMoreIn')}</p>
      <p className={styles.note}>{t('guide.comboIfOneMove')}</p>
    </>
  );
}

function TiersTab() {
  return (
    <>
      <p className={styles.lead}>{t('guide.threeOrMoreIdentical')}</p>
      <p className={styles.note}>{t('guide.aLongMergeGives')}</p>

      <ol className={styles.ladder}>
        {ladderRows().map((row) => (
          <li className={styles.rung} key={row.tier}>
            <Harvested what="gargoyle" tier={row.tier} />
            <span className={styles.rungName}>{row.name}</span>
          </li>
        ))}
      </ol>

      <p>{t('guide.mergingCostsSpaceThree')}</p>
      <p className={styles.note}>{t('guide.withEachTierA')}</p>
      <p className={styles.note}>{t('guide.chalicesClimbTheSame')}</p>
    </>
  );
}

function EnemiesTab() {
  return (
    <>
      <p className={styles.lead}>{t('guide.aHunterWalksStraight')}</p>
      <p>{t('guide.soYouCannotBuild')}</p>
      <p className={styles.note}>{t('guide.soldiersMarchInA')}</p>
      <div className={styles.boss}>
        <h3 className={styles.phaseTitle}>{t('guide.thePreacher')}</h3>
        <p>{t('guide.preacherComes', { nights: listNights(BOSS_CONFIG.nights) })}</p>
        <p className={styles.note}>{t('guide.onABossNight')}</p>
      </div>
      <div className={styles.boss}>
        <h3 className={styles.phaseTitle}>{t('guide.citadelTowers')}</h3>
        <p>{t('guide.twoTowersStandAbove')}</p>
        <p className={styles.note}>{t('guide.anOccupiedTowerOnly')}</p>
      </div>
      <div className={styles.boss}>
        <h3 className={styles.phaseTitle}>{t('guide.dayOffTitle')}</h3>
        <p>{t('guide.dayOffText')}</p>
      </div>
    </>
  );
}

const TAB_BODY: Readonly<Record<GuideTabId, () => React.JSX.Element>> = {
  night: NightTab,
  matches: MatchesTab,
  tiers: TiersTab,
  enemies: EnemiesTab,
};

export function GuidePanel({ onClose }: GuidePanelProps) {
  const [tab, setTab] = useState<GuideTabId>('night');
  const Body = TAB_BODY[tab];

  return (
    <Sheet title={t('guide.howToPlay')} onClose={onClose}>
      <div className={styles.tabs} role="tablist" aria-label={t('guide.helpSections')}>
        {GUIDE_TABS.map((item) => (
          <button
            key={item.id}
            className={item.id === tab ? styles.tabOn : styles.tab}
            type="button"
            role="tab"
            aria-selected={item.id === tab}
            onClick={() => {
              setTab(item.id);
            }}
          >
            {t(`guide.tabs.${item.id}`)}
          </button>
        ))}
      </div>

      <div className={styles.page} role="tabpanel" key={tab}>
        <Body />
      </div>
    </Sheet>
  );
}
