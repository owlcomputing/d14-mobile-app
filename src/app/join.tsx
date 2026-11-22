import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  Chips,
  Field,
  formatDateInput,
  formatPhoneInput,
  isPhone,
  parseBirthdate,
  PickerField,
} from '@/components/form-fields';
import { Widget } from '@/components/widget';
import { Radius, Spacing } from '@/constants/theme';
import { COUNTRIES, US_STATES } from '@/constants/us-states';
import {
  removeFamilyMember,
  startNewMembership,
  type FamilyMemberInput,
  type MembershipOption,
} from '@/lib/new-membership';
import { useDivisions, useFamilyMembers } from '@/lib/queries';
import { makeStyles, useColors } from '@/lib/theme';
import { useAuth } from '@/providers/auth-provider';

type Step = 'option' | 'details' | 'family' | 'review';

type KidDraft = {
  key: string;
  firstName: string;
  middleInitial: string;
  lastName: string;
  suffix: string;
  birthdate: string; // MM/DD/YYYY as typed
  amaNumber: string;
  disciplines: string[];
};

const OPTIONS: {
  value: MembershipOption;
  title: string;
  detail: string;
  icon: 'person' | 'people' | 'happy';
}[] = [
  { value: 'self', title: 'Just me', detail: 'One membership for you.', icon: 'person' },
  {
    value: 'selfAndFamily',
    title: 'Me and my family',
    detail: 'You plus family members (e.g. kids who ride).',
    icon: 'people',
  },
  {
    value: 'familyOnly',
    title: 'Family members only',
    detail: "Kids who ride; you're not riding yourself.",
    icon: 'happy',
  },
];

const newKid = (): KidDraft => ({
  key: `${Date.now()}-${Math.random()}`,
  firstName: '',
  middleInitial: '',
  lastName: '',
  suffix: '',
  birthdate: '',
  amaNumber: '',
  disciplines: [],
});

/**
 * Become a D14 member in the app (individual / family). Same data and
 * checkout as the website's membership form; charter (club) memberships stay
 * on the website.
 */
export default function JoinScreen() {
  const c = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { profile, session, isMember, profileReady, refreshProfile } = useAuth();
  const divisions = useDivisions();
  const family = useFamilyMembers(profile?.id);
  const disciplineOptions = useMemo(
    () => divisions.data?.map((d) => d.name).filter((n): n is string => !!n) ?? [],
    [divisions.data],
  );

  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [step, setStep] = useState<Step>('option');
  const [option, setOption] = useState<MembershipOption | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<string | null>(null);

  // Account holder
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [middleInitial, setMiddleInitial] = useState(profile?.middle_initial ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [suffix, setSuffix] = useState(profile?.suffix ?? '');
  const [birthdate, setBirthdate] = useState('');
  const [cellPhone, setCellPhone] = useState(formatPhoneInput(profile?.cell_phone ?? ''));
  const [addressLine1, setAddressLine1] = useState(profile?.address_line1 ?? '');
  const [addressLine2, setAddressLine2] = useState(profile?.address_line2 ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [country, setCountry] = useState(profile?.country || 'United States');
  const [state, setState] = useState(profile?.state ?? '');
  const [zip, setZip] = useState(profile?.zip ?? '');
  const [amaNumber, setAmaNumber] = useState(profile?.ama_number ?? '');
  const [disciplines, setDisciplines] = useState<string[]>(profile?.disciplines ?? []);
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Family
  const [kids, setKids] = useState<KidDraft[]>([]);
  const [removing, setRemoving] = useState<string | null>(null);
  // Family members left over from an earlier, unpaid attempt (no membership yet).
  // Checkout charges for every family account, so show them and allow removal.
  const pendingFamily = (family.data ?? []).filter((f) => !f.memberships);

  const email = profile?.email ?? session?.user.email ?? '';
  const includesFamily = option === 'selfAndFamily' || option === 'familyOnly';
  const memberCount =
    (option === 'familyOnly' ? 0 : 1) + (includesFamily ? kids.length + pendingFamily.length : 0);

  if (profileReady && isMember) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="checkmark-circle" size={48} color={c.success} />
        <Text style={styles.doneTitle}>You&apos;re already a member</Text>
        <Text style={styles.doneText}>
          To add family members or renew, open Family Members in your Profile, or the Wallet.
        </Text>
      </View>
    );
  }

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  // --- Validation ---------------------------------------------------------
  const validateDetails = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = 'Required';
    if (!lastName.trim()) e.lastName = 'Required';
    if (!parseBirthdate(birthdate)) e.birthdate = 'Enter a valid date as MM/DD/YYYY';
    if (!isPhone(cellPhone)) e.cellPhone = 'Enter a 10-digit phone number';
    if (!addressLine1.trim()) e.addressLine1 = 'Required';
    if (!city.trim()) e.city = 'Required';
    if (!state.trim()) e.state = 'Required';
    if (!zip.trim()) e.zip = 'Required';
    if (emergencyPhone && !isPhone(emergencyPhone))
      e.emergencyPhone = 'Enter a 10-digit phone number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateFamily = () => {
    const e: Record<string, string> = {};
    kids.forEach((k) => {
      if (!k.firstName.trim()) e[`${k.key}.firstName`] = 'Required';
      if (!k.lastName.trim()) e[`${k.key}.lastName`] = 'Required';
      if (!parseBirthdate(k.birthdate))
        e[`${k.key}.birthdate`] = 'Enter a valid date as MM/DD/YYYY';
    });
    if (kids.length + pendingFamily.length === 0) e.family = 'Add at least one family member.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // --- Navigation ---------------------------------------------------------
  // Each step change, and each failed validation, scrolls back to the top so
  // the new step (or the first error) is in view.
  const toTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });
  const next = () => {
    if (step === 'option' && option) setStep('details');
    else if (step === 'details') {
      if (validateDetails()) setStep(includesFamily ? 'family' : 'review');
    } else if (step === 'family') {
      if (validateFamily()) setStep('review');
    }
    toTop();
  };
  const back = () => {
    setErrors({});
    if (step === 'details') setStep('option');
    else if (step === 'family') setStep('details');
    else if (step === 'review') setStep(includesFamily ? 'family' : 'details');
    else router.back();
    toTop();
  };

  const updateKid = (key: string, patch: Partial<KidDraft>) =>
    setKids((prev) => prev.map((k) => (k.key === key ? { ...k, ...patch } : k)));

  const removePending = (id: string, name: string) =>
    Alert.alert('Remove family member?', `${name} will be removed and won't be charged.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemoving(id);
          try {
            await removeFamilyMember(id);
            await family.refetch();
          } catch (err) {
            Alert.alert('Could not remove', err instanceof Error ? err.message : String(err));
          } finally {
            setRemoving(null);
          }
        },
      },
    ]);

  // --- Pay ----------------------------------------------------------------
  const pay = async () => {
    if (!profile || !option || working) return;
    try {
      const familyInput: FamilyMemberInput[] = includesFamily
        ? kids.map((k) => ({
            firstName: k.firstName,
            middleInitial: k.middleInitial,
            lastName: k.lastName,
            suffix: k.suffix,
            birthdate: parseBirthdate(k.birthdate)!,
            amaNumber: k.amaNumber,
            disciplines: k.disciplines,
          }))
        : [];
      const outcome = await startNewMembership(
        {
          profileId: profile.id,
          email,
          option,
          newFamily: familyInput,
          holder: {
            firstName,
            middleInitial,
            lastName,
            suffix,
            birthdate: parseBirthdate(birthdate)!,
            cellPhone,
            addressLine1,
            addressLine2,
            city,
            state,
            zip,
            country,
            amaNumber,
            disciplines,
            emergencyName,
            emergencyPhone,
          },
        },
        setWorking,
      );
      // New family accounts exist now even if payment didn't finish; don't recreate them.
      setKids([]);
      await family.refetch();

      if (outcome === 'paid') {
        await refreshProfile();
        Alert.alert(
          'Welcome to District 14!',
          'Your membership is active. Your digital membership card is in the Wallet.',
          [{ text: 'Open Wallet', onPress: () => router.replace('/wallet') }],
        );
      } else if (outcome === 'processing') {
        Alert.alert(
          'Payment processing',
          'Your payment is still processing. Your membership will activate automatically once it completes.',
          [{ text: 'OK', onPress: () => router.back() }],
        );
      } else {
        Alert.alert('Checkout not completed', 'No payment was made. You can try again anytime.');
      }
    } catch (err) {
      Alert.alert('Could not complete signup', err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(null);
    }
  };

  // --- Render -------------------------------------------------------------
  const stepIndex = ['option', 'details', ...(includesFamily ? ['family'] : []), 'review'].indexOf(
    step,
  );
  const stepCount = includesFamily ? 4 : 3;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.stepLabel}>
          Step {stepIndex + 1} of {stepCount}
        </Text>

        {step === 'option' ? (
          <>
            <Text style={styles.title}>Who&apos;s joining?</Text>
            <Text style={styles.subtitle}>
              An AMA District 14 membership is for one year. Each person needs their own membership.
            </Text>
            {OPTIONS.map((o) => (
              <Pressable
                key={o.value}
                style={[styles.optionCard, option === o.value && styles.optionCardOn]}
                onPress={() => setOption(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: option === o.value }}>
                <Ionicons name={o.icon} size={22} color={c.red} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.optionTitle}>{o.title}</Text>
                  <Text style={styles.optionDetail}>{o.detail}</Text>
                </View>
                <Ionicons
                  name={option === o.value ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={option === o.value ? c.red : c.textTertiary}
                />
              </Pressable>
            ))}
            <Text style={styles.note}>
              Joining as a club (charter membership)? Use the D14 website.
            </Text>
          </>
        ) : null}

        {step === 'details' ? (
          <>
            <Text style={styles.title}>
              {option === 'familyOnly' ? 'Parent / guardian details' : 'Your details'}
            </Text>
            <Text style={styles.subtitle}>
              {option === 'familyOnly'
                ? "You'll be the contact for the family memberships."
                : 'This goes on your membership record and card.'}
            </Text>

            <View style={styles.row}>
              <Field
                label="First name"
                required
                value={firstName}
                onChangeText={setFirstName}
                error={errors.firstName}
                style={{ flex: 3 }}
                autoComplete="given-name"
              />
              <Field
                label="M.I."
                value={middleInitial}
                onChangeText={(t) => setMiddleInitial(t.slice(0, 1).toUpperCase())}
                style={{ flex: 1 }}
              />
            </View>
            <View style={styles.row}>
              <Field
                label="Last name"
                required
                value={lastName}
                onChangeText={setLastName}
                error={errors.lastName}
                style={{ flex: 3 }}
                autoComplete="family-name"
              />
              <Field
                label="Suffix"
                value={suffix}
                onChangeText={setSuffix}
                placeholder="Jr."
                style={{ flex: 1 }}
              />
            </View>
            <Field label="Email" value={email} editable={false} style={{ opacity: 0.7 }} />
            <View style={styles.row}>
              <Field
                label="Birthdate"
                required
                value={birthdate}
                onChangeText={(t) => setBirthdate(formatDateInput(t))}
                placeholder="MM/DD/YYYY"
                keyboardType="number-pad"
                error={errors.birthdate}
                style={{ flex: 1 }}
              />
              <Field
                label="Cell phone"
                required
                value={cellPhone}
                onChangeText={(t) => setCellPhone(formatPhoneInput(t))}
                keyboardType="phone-pad"
                autoComplete="tel"
                error={errors.cellPhone}
                style={{ flex: 1 }}
              />
            </View>

            <Field
              label="Address"
              required
              value={addressLine1}
              onChangeText={setAddressLine1}
              autoComplete="address-line1"
              error={errors.addressLine1}
            />
            <Field
              label="Address line 2"
              value={addressLine2}
              onChangeText={setAddressLine2}
              autoComplete="address-line2"
            />
            <Field label="City" required value={city} onChangeText={setCity} error={errors.city} />
            <PickerField
              label="Country"
              value={country}
              options={COUNTRIES}
              onChange={(value) => {
                setCountry(value);
                setState('');
              }}
              required
            />
            <View style={styles.row}>
              <View style={{ flex: 2 }}>
                {country === 'United States' ? (
                  <PickerField
                    label="State"
                    value={state}
                    options={US_STATES}
                    onChange={setState}
                    required
                    error={errors.state}
                  />
                ) : (
                  <Field
                    label="Province"
                    required
                    value={state}
                    onChangeText={setState}
                    error={errors.state}
                  />
                )}
              </View>
              <Field
                label={country === 'United States' ? 'ZIP' : 'Postal code'}
                required
                value={zip}
                onChangeText={setZip}
                autoComplete="postal-code"
                error={errors.zip}
                style={{ flex: 1 }}
              />
            </View>

            <Field
              label="AMA number"
              value={amaNumber}
              onChangeText={setAmaNumber}
              keyboardType="number-pad"
              placeholder="If you have one"
            />
            {option !== 'familyOnly' ? (
              <View style={{ marginTop: Spacing.three }}>
                <Text style={styles.fieldLabel}>Disciplines you ride</Text>
                <Chips
                  options={disciplineOptions}
                  selected={disciplines}
                  onToggle={(d) => setDisciplines((p) => toggle(p, d))}
                />
              </View>
            ) : null}

            <Text style={styles.section}>Emergency contact</Text>
            <View style={styles.row}>
              <Field
                label="Name"
                value={emergencyName}
                onChangeText={setEmergencyName}
                style={{ flex: 1 }}
              />
              <Field
                label="Phone"
                value={emergencyPhone}
                onChangeText={(t) => setEmergencyPhone(formatPhoneInput(t))}
                keyboardType="phone-pad"
                error={errors.emergencyPhone}
                style={{ flex: 1 }}
              />
            </View>
          </>
        ) : null}

        {step === 'family' ? (
          <>
            <Text style={styles.title}>Family members</Text>
            <Text style={styles.subtitle}>
              Each family member gets their own membership and card. They share your address and
              phone number.
            </Text>

            {pendingFamily.length ? (
              <Widget header="Already added (not paid yet)">
                {pendingFamily.map((f) => {
                  const name = [f.first_name, f.last_name].filter(Boolean).join(' ');
                  return (
                    <View key={f.id} style={styles.pendingRow}>
                      <Text style={styles.pendingName}>{name}</Text>
                      {removing === f.id ? (
                        <ActivityIndicator color={c.textTertiary} />
                      ) : (
                        <Pressable onPress={() => removePending(f.id, name)} hitSlop={8}>
                          <Text style={styles.removeText}>Remove</Text>
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </Widget>
            ) : null}

            {kids.map((k, i) => (
              <Widget key={k.key} header={`Family member ${pendingFamily.length + i + 1}`}>
                <View style={styles.row}>
                  <Field
                    label="First name"
                    required
                    value={k.firstName}
                    onChangeText={(t) => updateKid(k.key, { firstName: t })}
                    error={errors[`${k.key}.firstName`]}
                    style={{ flex: 3 }}
                  />
                  <Field
                    label="M.I."
                    value={k.middleInitial}
                    onChangeText={(t) =>
                      updateKid(k.key, { middleInitial: t.slice(0, 1).toUpperCase() })
                    }
                    style={{ flex: 1 }}
                  />
                </View>
                <View style={styles.row}>
                  <Field
                    label="Last name"
                    required
                    value={k.lastName}
                    onChangeText={(t) => updateKid(k.key, { lastName: t })}
                    error={errors[`${k.key}.lastName`]}
                    style={{ flex: 3 }}
                  />
                  <Field
                    label="Suffix"
                    value={k.suffix}
                    onChangeText={(t) => updateKid(k.key, { suffix: t })}
                    style={{ flex: 1 }}
                  />
                </View>
                <View style={styles.row}>
                  <Field
                    label="Birthdate"
                    required
                    value={k.birthdate}
                    onChangeText={(t) => updateKid(k.key, { birthdate: formatDateInput(t) })}
                    placeholder="MM/DD/YYYY"
                    keyboardType="number-pad"
                    error={errors[`${k.key}.birthdate`]}
                    style={{ flex: 1 }}
                  />
                  <Field
                    label="AMA number"
                    value={k.amaNumber}
                    onChangeText={(t) => updateKid(k.key, { amaNumber: t })}
                    keyboardType="number-pad"
                    style={{ flex: 1 }}
                  />
                </View>
                <View style={{ marginTop: Spacing.three }}>
                  <Text style={styles.fieldLabel}>Disciplines</Text>
                  <Chips
                    options={disciplineOptions}
                    selected={k.disciplines}
                    onToggle={(d) => updateKid(k.key, { disciplines: toggle(k.disciplines, d) })}
                  />
                </View>
                <Pressable
                  onPress={() => setKids((p) => p.filter((x) => x.key !== k.key))}
                  style={styles.removeKid}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </Widget>
            ))}

            <Pressable
              style={styles.addKid}
              onPress={() => setKids((p) => [...p, { ...newKid(), lastName }])}>
              <Ionicons name="add-circle" size={20} color={c.red} />
              <Text style={styles.addKidText}>Add a family member</Text>
            </Pressable>
            {errors.family ? <Text style={styles.error}>{errors.family}</Text> : null}
          </>
        ) : null}

        {step === 'review' ? (
          <>
            <Text style={styles.title}>Review &amp; pay</Text>
            <Widget header="Memberships">
              {option !== 'familyOnly' ? (
                <ReviewRow name={`${firstName} ${lastName}`.trim()} detail="You" />
              ) : null}
              {includesFamily
                ? pendingFamily.map((f) => (
                    <ReviewRow
                      key={f.id}
                      name={[f.first_name, f.last_name].filter(Boolean).join(' ')}
                      detail="Family member"
                    />
                  ))
                : null}
              {includesFamily
                ? kids.map((k) => (
                    <ReviewRow
                      key={k.key}
                      name={`${k.firstName} ${k.lastName}`.trim()}
                      detail="Family member"
                    />
                  ))
                : null}
            </Widget>
            <Text style={styles.subtitle}>
              {memberCount} membership{memberCount === 1 ? '' : 's'}, valid for one year from today.
              You&apos;ll see the total on the secure payment page before you pay.
            </Text>
            <Text style={styles.note}>
              Contact: {email}
              {'\n'}
              {addressLine1}
              {addressLine2 ? `, ${addressLine2}` : ''}, {city}, {state} {zip}
            </Text>
          </>
        ) : null}

        <View style={styles.nav}>
          <Pressable style={styles.backButton} onPress={back} disabled={!!working}>
            <Text style={styles.backText}>{step === 'option' ? 'Cancel' : 'Back'}</Text>
          </Pressable>
          {step === 'review' ? (
            <Pressable
              style={({ pressed }) => [
                styles.nextButton,
                pressed && { backgroundColor: c.redDark },
              ]}
              onPress={pay}
              disabled={!!working}>
              {working ? (
                <View style={styles.workingRow}>
                  <ActivityIndicator color={c.onAccent} />
                  <Text style={styles.nextText}>{working}</Text>
                </View>
              ) : (
                <Text style={styles.nextText}>Continue to Payment</Text>
              )}
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.nextButton,
                step === 'option' && !option && styles.disabled,
                pressed && { backgroundColor: c.redDark },
              ]}
              onPress={next}
              disabled={step === 'option' && !option}>
              <Text style={styles.nextText}>Continue</Text>
            </Pressable>
          )}
        </View>
        {step === 'review' ? (
          <Text style={styles.note}>
            Payment is processed securely by Stripe. You&apos;ll come back to the app when finished.
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ReviewRow({ name, detail }: { name: string; detail: string }) {
  const styles = useStyles();
  return (
    <View style={styles.pendingRow}>
      <Text style={styles.pendingName}>{name || '—'}</Text>
      <Text style={styles.reviewDetail}>{detail}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  stepLabel: {
    color: c.red,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: { color: c.text, fontSize: 24, fontWeight: '800', marginTop: Spacing.one },
  subtitle: {
    color: c.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  section: {
    color: c.red,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: Spacing.four,
  },
  fieldLabel: {
    color: c.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.two,
  },
  row: { flexDirection: 'row', gap: Spacing.two },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    marginTop: Spacing.three,
  },
  optionCardOn: { borderColor: c.red },
  optionTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  optionDetail: { color: c.textSecondary, fontSize: 12, marginTop: 2 },
  note: {
    color: c.textTertiary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: Spacing.three,
    textAlign: 'center',
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  pendingName: { color: c.text, fontSize: 14, fontWeight: '600' },
  reviewDetail: { color: c.textTertiary, fontSize: 12 },
  removeText: { color: c.error, fontSize: 13, fontWeight: '600' },
  removeKid: { alignSelf: 'flex-end', marginTop: Spacing.three },
  addKid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: c.border,
    borderRadius: Radius.md,
    paddingVertical: 14,
    marginTop: Spacing.two,
  },
  addKidText: { color: c.text, fontSize: 14, fontWeight: '600' },
  error: { color: c.error, fontSize: 12, marginTop: Spacing.two, textAlign: 'center' },
  nav: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.four },
  backButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 15,
  },
  backText: { color: c.text, fontSize: 15, fontWeight: '600' },
  nextButton: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.red,
    borderRadius: Radius.md,
    paddingVertical: 15,
  },
  nextText: { color: c.onAccent, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  workingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  doneTitle: { color: c.text, fontSize: 20, fontWeight: '700', marginTop: Spacing.three },
  doneText: {
    color: c.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
}));
