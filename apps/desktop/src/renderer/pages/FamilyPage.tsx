import { useEffect, useState, type FormEvent, type JSX } from 'react';
import type { ConsentScope, FamilyAsk, Person, PreferredLanguage } from '@kinlore/core';
import type { LibrarySnapshot } from '@kinlore/ipc-contract';
import { Icon } from '../components/Icons.js';
import { StatusBanner } from '../components/StatusBanner.js';
import {
  ClipList,
  LANGUAGE_OPTIONS,
  stamp,
  type RunWorkFn,
  type Section,
  type TranslateFn,
} from './shared.js';

export type FamilySection = 'people' | 'family';

const CONSENT_ITEMS: readonly {
  scope: ConsentScope;
  titleKey: 'recordingOk' | 'archiveOk' | 'allowSharing';
  descKey: 'consentRecordingDesc' | 'consentArchiveDesc' | 'consentExportDesc';
}[] = [
  { scope: 'recording', titleKey: 'recordingOk', descKey: 'consentRecordingDesc' },
  { scope: 'archive', titleKey: 'archiveOk', descKey: 'consentArchiveDesc' },
  { scope: 'export', titleKey: 'allowSharing', descKey: 'consentExportDesc' },
];

function PeopleView(props: {
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: TranslateFn;
  run: RunWorkFn;
}): JSX.Element {
  const [name, setName] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<PreferredLanguage>(props.language);

  useEffect(() => {
    setPreferredLanguage(props.language);
  }, [props.language]);

  async function onAdd(event: FormEvent): Promise<void> {
    event.preventDefault();
    const displayName = name.trim();
    if (displayName === '') {
      return;
    }
    await props.run(async () => {
      const now = stamp();
      await window.kinlore.savePerson({
        id: crypto.randomUUID(),
        displayName,
        preferredLanguage,
        createdAt: now,
        updatedAt: now,
      });
      setName('');
    });
  }

  function updatePersonLanguage(person: Person, nextLanguage: PreferredLanguage): void {
    void props.run(async () => {
      await window.kinlore.savePerson({
        ...person,
        preferredLanguage: nextLanguage,
        updatedAt: stamp(),
      });
    });
  }

  return (
    <div className="family-stack">
      <section className="panel add-person-card">
        <h3>{props.t('addPerson')}</h3>
        <p className="muted">{props.t('consentHint')}</p>
        <form
          className="inline-form"
          onSubmit={(event) => {
            void onAdd(event);
          }}
        >
          <div className="control-grow">
            <label htmlFor="displayName">{props.t('name')}</label>
            <input
              id="displayName"
              required
              maxLength={120}
              placeholder={props.t('familyMemberNamePlaceholder')}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>
          <div className="filter-select">
            <label htmlFor="newPersonLang">{props.t('preferredLanguage')}</label>
            <select
              id="newPersonLang"
              value={preferredLanguage}
              onChange={(event) => setPreferredLanguage(event.target.value as PreferredLanguage)}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={name.trim() === ''}>
            <Icon name="people" size={16} />
            {props.t('addPerson')}
          </button>
        </form>
      </section>

      {props.library.people.length === 0 ? (
        <section className="empty-state panel">
          <Icon name="people" size={28} />
          <h3>{props.t('addFirstPerson')}</h3>
          <p>{props.t('firstPersonHelp')}</p>
        </section>
      ) : (
        <div className="family-grid">
          {props.library.people.map((person) => {
            const count = props.library.recordings.filter((recording) =>
              recording.personIds.includes(person.id),
            ).length;
            const personLang = person.preferredLanguage ?? 'en';
            return (
              <article key={person.id} className="panel person-card">
                <div className="person-card-top">
                  <div className="person-heading">
                    <span className="avatar" aria-hidden="true">
                      {Array.from(person.displayName)[0] ?? '?'}
                    </span>
                    <div>
                      <h3>{person.displayName}</h3>
                      <p className="muted">
                        {count} {props.t('recordingsCount')}
                      </p>
                    </div>
                  </div>
                  <div className="person-language-picker">
                    <label htmlFor={`lang-${person.id}`} className="sr-only">
                      {props.t('preferredLanguage')}
                    </label>
                    <select
                      id={`lang-${person.id}`}
                      aria-label={`${person.displayName} ${props.t('preferredLanguage')}`}
                      value={personLang}
                      onChange={(event) =>
                        updatePersonLanguage(person, event.target.value as PreferredLanguage)
                      }
                    >
                      {LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="consent-list">
                  {CONSENT_ITEMS.map((item) => {
                    const granted = props.library.consents.some(
                      (consent) =>
                        consent.personId === person.id &&
                        consent.scope === item.scope &&
                        consent.granted,
                    );
                    return (
                      <label
                        key={item.scope}
                        className={granted ? 'consent-switch is-granted' : 'consent-switch'}
                      >
                        <div className="consent-switch-copy">
                          <span className="consent-switch-title">{props.t(item.titleKey)}</span>
                          <span className="consent-switch-desc muted">{props.t(item.descKey)}</span>
                        </div>
                        <span className="switch-control">
                          <input
                            type="checkbox"
                            role="switch"
                            aria-checked={granted}
                            checked={granted}
                            onChange={() => {
                              void props.run(async () => {
                                const existing = props.library.consents.find(
                                  (consent) =>
                                    consent.personId === person.id && consent.scope === item.scope,
                                );
                                const now = stamp();
                                const nextGranted = !granted;
                                await window.kinlore.saveConsent({
                                  id: existing?.id ?? crypto.randomUUID(),
                                  personId: person.id,
                                  scope: item.scope,
                                  granted: nextGranted,
                                  ...(nextGranted ? { grantedAt: now } : {}),
                                  ...(existing?.grantedAt !== undefined && !nextGranted
                                    ? { grantedAt: existing.grantedAt }
                                    : {}),
                                  createdAt: existing?.createdAt ?? now,
                                  updatedAt: now,
                                });
                              });
                            }}
                          />
                          <span className="switch-track" aria-hidden="true">
                            <span className="switch-thumb" />
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AskFamilyView(props: {
  library: LibrarySnapshot;
  t: TranslateFn;
  run: RunWorkFn;
}): JSX.Element {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<FamilyAsk | undefined>(undefined);

  return (
    <section className="panel">
      <h3>{props.t('navFamily')}</h3>
      <p className="muted">{props.t('familyPrompt')}</p>
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (question.trim() === '') return;
          void props.run(
            async () => {
              setResult(await window.kinlore.askFamily(question.trim()));
            },
            { silent: true },
          );
        }}
      >
        <div className="control-grow">
          <label htmlFor="familyAsk">{props.t('question')}</label>
          <input
            id="familyAsk"
            value={question}
            placeholder={props.t('askFamilyPlaceholder')}
            onChange={(event) => {
              setQuestion(event.target.value);
            }}
          />
        </div>
        <button type="submit" disabled={question.trim() === ''}>
          <Icon name="search" size={16} />
          {props.t('ask')}
        </button>
      </form>
      {result !== undefined && result.distinctVoices >= 2 ? (
        <StatusBanner tone="info" message={props.t('separate')} />
      ) : null}
      <div className="family-ask-grid">
        {result?.memories.map((memory) => (
          <article key={memory.personId} className="card family-memory-card">
            <div className="person-heading">
              <span className="avatar" aria-hidden="true">
                {Array.from(memory.displayName)[0] ?? '?'}
              </span>
              <h4>{memory.displayName}</h4>
            </div>
            {memory.response.kind === 'unknown' ? (
              <p className="muted">{props.t('unknown')}</p>
            ) : (
              <ClipList library={props.library} clips={memory.response.clips} />
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export function FamilyPage(props: {
  section: FamilySection;
  library: LibrarySnapshot;
  language: PreferredLanguage;
  t: TranslateFn;
  run: RunWorkFn;
  onNavigate: (section: Section) => void;
}): JSX.Element {
  return (
    <div className="family-workspace">
      <div className="subnav" role="tablist" aria-label={props.t('familySpace')}>
        {(
          [
            {
              id: 'people' as const,
              key: 'navPeople' as const,
              count: props.library.people.length,
            },
            { id: 'family' as const, key: 'allVoices' as const, count: undefined },
          ] as const
        ).map((tab) => {
          const active = props.section === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              role="tab"
              aria-selected={active}
              className={active ? 'current' : undefined}
              onClick={() => props.onNavigate(tab.id)}
            >
              <span>{props.t(tab.key)}</span>
              {tab.count !== undefined ? <span className="subnav-count">{tab.count}</span> : null}
            </button>
          );
        })}
      </div>

      {props.section === 'people' ? (
        <PeopleView library={props.library} language={props.language} t={props.t} run={props.run} />
      ) : (
        <AskFamilyView library={props.library} t={props.t} run={props.run} />
      )}
    </div>
  );
}
