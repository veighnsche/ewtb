import {
	addDays,
	eachDayOfInterval,
	format,
	formatISO,
	isBefore,
	isSameDay,
	isSameMonth,
	isWeekend,
	startOfMonth,
	startOfWeek,
} from "date-fns";
import {
	Bot,
	Clock3,
	Cpu,
	ListTodo,
	Mail,
	Newspaper,
	Rows3,
	Sparkles,
	SunMedium,
	TriangleAlert,
} from "lucide-react";
import {
	startTransition,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import type { IconType } from "react-icons";
import {
	WiCloud,
	WiCloudy,
	WiDayCloudy,
	WiDayCloudyGusts,
	WiDaySunny,
	WiFog,
	WiHail,
	WiRain,
	WiShowers,
	WiSnow,
	WiSleet,
	WiThunderstorm,
	WiSprinkle,
} from "react-icons/wi";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "#/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Progress } from "#/components/ui/progress";
import { getWallAgenda } from "#/lib/server/agenda";
import { getWallNewsFeed } from "#/lib/server/news";
import { getWallCollector } from "#/lib/server/wall";
import { getWallWeather } from "#/lib/server/weather";
import type {
	AgendaItem,
	AgendaTask,
	ClockCard,
	Headline,
	HealthState,
	HostMetric,
	HostStatus,
} from "#/lib/wall-types";

type LiveWidgets = {
	wall: Awaited<ReturnType<typeof getWallCollector>>;
	agenda: Awaited<ReturnType<typeof getWallAgenda>>;
	clocks: ClockCard[];
	weather: Awaited<ReturnType<typeof getWallWeather>>;
	newsFeed: Awaited<ReturnType<typeof getWallNewsFeed>>;
};

type LiveStore<T> = {
	getSnapshot: () => T;
	subscribe: (listener: () => void) => () => void;
	setSnapshot: (nextSnapshot: T) => void;
};

type WorkTone = "focus" | "watch" | "plan" | "ok";

type EmailItem = {
	id: string;
	from: string;
	subject: string;
	preview: string;
	age: string;
	tone: WorkTone;
};

const CLOCKS = [
	{ label: "Parijs", timeZone: "Europe/Paris" },
	{ label: "Palo Alto", timeZone: "America/Los_Angeles" },
	{ label: "Shenzhen", timeZone: "Asia/Shanghai" },
] as const;

const WALL_CANVAS_COLUMNS = 5;
const WALL_VISIBLE_COLUMNS = 3;
const WALL_PAN_CYCLE_MS = 110_000;

const NEWS_PAGE_SIZE = 7;
const NEWS_PAGE_INTERVAL_MS = 12_000;
const NEWS_REFRESH_OK_MS = 5 * 60_000;
const NEWS_REFRESH_LOADING_MS = 5_000;
const AGENDA_REFRESH_OK_MS = 60_000;
const AGENDA_REFRESH_LOADING_MS = 5_000;
const WEATHER_REFRESH_OK_MS = 60_000;
const WEATHER_REFRESH_LOADING_MS = 15_000;
const WALL_REFRESH_MS = 5_000;
const CLOCK_REFRESH_MS = 30_000;

const EMAIL_ITEMS: EmailItem[] = [
	{
		id: "mail-ops",
		from: "Ops",
		subject: "Racktemperatuur vraagt bevestiging",
		preview: "Wil je vóór 14:00 bevestigen dat de nieuwe curve actief is?",
		age: "8m",
		tone: "focus",
	},
	{
		id: "mail-client",
		from: "Client",
		subject: "Agenda voor volgende week",
		preview: "Ze willen twee afspraken samenvoegen en een contact toevoegen.",
		age: "24m",
		tone: "watch",
	},
	{
		id: "mail-travel",
		from: "Travel",
		subject: "Reisdocumenten bijgewerkt",
		preview:
			"Nieuwe tijden staan klaar, maar iemand moet de takenlijst nalopen.",
		age: "49m",
		tone: "plan",
	},
	{
		id: "mail-newsletter",
		from: "Nieuwsbrief",
		subject: "Nieuwe tooling voor teams",
		preview: "Kan wachten; alleen archiveren of labelen als referentie.",
		age: "2u",
		tone: "ok",
	},
];

export const Route = createFileRoute("/")({
	loader: async () => getLiveWidgets(),
	component: App,
});

function healthStateLabel(state: HealthState) {
	switch (state) {
		case "healthy":
			return "ok";
		case "warning":
			return "waarschuwing";
		case "critical":
			return "kritiek";
	}
}

function toneClasses(state: HealthState) {
	switch (state) {
		case "healthy":
			return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
		case "warning":
			return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
		case "critical":
			return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
	}
}

function App() {
	const liveWidgets = Route.useLoaderData();
	const wallStore = useLiveStore(liveWidgets.wall);
	const agendaStore = useLiveStore(liveWidgets.agenda);
	const weatherStore = useLiveStore(liveWidgets.weather);
	const newsStore = useLiveStore(liveWidgets.newsFeed);
	const panViewportRef = useRef<HTMLDivElement>(null);

	useWallPanAnimation(panViewportRef);

	return (
		<>
			<WallStoreController store={wallStore} />
			<AgendaStoreController store={agendaStore} />
			<WeatherStoreController store={weatherStore} />
			<NewsStoreController store={newsStore} />

			<main className="h-[100svh] w-screen overflow-hidden px-6 py-5 2xl:px-8 2xl:py-6">
				<div className="grid h-full grid-rows-[auto_minmax(0,1fr)] gap-4">
					<header className="grid grid-cols-[0.95fr_1.35fr_0.9fr] items-stretch gap-4">
						<WallHero store={wallStore} />
						<CalendarPanelLive store={agendaStore} />
						<div className="grid grid-cols-2 gap-3">
							<WallStatusChips store={wallStore} />
							<NewsStatusChip store={newsStore} />
							<WeatherStatusChip store={weatherStore} />
						</div>
					</header>

					<div
						ref={panViewportRef}
						className="wall-pan-viewport h-full min-h-0 overflow-x-auto overflow-y-hidden"
					>
						<section
							className="wall-pan-track grid h-full min-h-0"
							style={
								{
									"--wall-pan-columns": String(WALL_CANVAS_COLUMNS),
									"--wall-visible-columns": String(WALL_VISIBLE_COLUMNS),
								} as React.CSSProperties
							}
						>
							<section className="wall-pan-column">
								<HostsPanelLive store={wallStore} />
							</section>
							<section className="wall-pan-column">
								<NewsPanelLive store={newsStore} />
							</section>
								<RightRail
									agendaStore={agendaStore}
									weatherStore={weatherStore}
									initialClocks={liveWidgets.clocks}
								/>
							<TaskMailboxColumn agendaStore={agendaStore} />
							<AssistantColumn
								wallStore={wallStore}
								agendaStore={agendaStore}
								newsStore={newsStore}
								weatherStore={weatherStore}
							/>
						</section>
					</div>
				</div>
			</main>
		</>
	);
}

function useWallPanAnimation(
	viewportRef: React.RefObject<HTMLDivElement | null>,
) {
	useEffect(() => {
		const viewport = viewportRef.current;
		if (!viewport || typeof window === "undefined") {
			return;
		}

		const motionPreference = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		);
		if (motionPreference.matches) {
			return;
		}

		let frame = 0;

		const tick = (time: number) => {
			const maxScroll = Math.max(
				viewport.scrollWidth - viewport.clientWidth,
				0,
			);

			if (maxScroll > 0) {
				const phase =
					((time % WALL_PAN_CYCLE_MS) / WALL_PAN_CYCLE_MS) * Math.PI * 2;
				const progress = (1 - Math.cos(phase)) / 2;
				viewport.scrollLeft = progress * maxScroll;
			}

			frame = window.requestAnimationFrame(tick);
		};

		frame = window.requestAnimationFrame(tick);

		return () => {
			window.cancelAnimationFrame(frame);
		};
	}, [viewportRef]);
}

function CalendarPanelLive({
	store,
}: {
	store: LiveStore<LiveWidgets["agenda"]>;
}) {
	const agenda = useLiveSnapshot(store);

	return <CalendarPanel agenda={agenda} />;
}

function RightRail({
	agendaStore,
	weatherStore,
	initialClocks,
}: {
	agendaStore: LiveStore<LiveWidgets["agenda"]>;
	weatherStore: LiveStore<LiveWidgets["weather"]>;
	initialClocks: ClockCard[];
}) {
	return (
		<section className="wall-pan-column grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-4">
			<AgendaPanelLive store={agendaStore} />

			<div className="grid min-h-0 grid-cols-2 gap-4">
				<ClocksPanelLive initialClocks={initialClocks} />
				<WeatherPanelLive store={weatherStore} />
			</div>
		</section>
	);
}

function TaskMailboxColumn({
	agendaStore,
}: {
	agendaStore: LiveStore<LiveWidgets["agenda"]>;
}) {
	return (
		<section className="wall-pan-column grid h-full min-h-0 grid-rows-[0.95fr_1.05fr] gap-4">
			<TasksPanelLive store={agendaStore} />
			<EmailPanel />
		</section>
	);
}

function AssistantColumn({
	wallStore,
	agendaStore,
	newsStore,
	weatherStore,
}: {
	wallStore: LiveStore<LiveWidgets["wall"]>;
	agendaStore: LiveStore<LiveWidgets["agenda"]>;
	newsStore: LiveStore<LiveWidgets["newsFeed"]>;
	weatherStore: LiveStore<LiveWidgets["weather"]>;
}) {
	const wall = useLiveSnapshot(wallStore);
	const agenda = useLiveSnapshot(agendaStore);
	const newsFeed = useLiveSnapshot(newsStore);
	const weather = useLiveSnapshot(weatherStore);

	return (
		<section className="wall-pan-column h-full min-h-0">
			<AssistantPanel
				wall={wall}
				agenda={agenda}
				newsFeed={newsFeed}
				weather={weather}
			/>
		</section>
	);
}

function createLiveStore<T>(initialSnapshot: T): LiveStore<T> {
	let snapshot = initialSnapshot;
	const listeners = new Set<() => void>();

	return {
		getSnapshot: () => snapshot,
		subscribe: (listener) => {
			listeners.add(listener);

			return () => {
				listeners.delete(listener);
			};
		},
		setSnapshot: (nextSnapshot) => {
			snapshot = nextSnapshot;
			for (const listener of listeners) {
				listener();
			}
		},
	};
}

function useLiveStore<T>(initialSnapshot: T): LiveStore<T> {
	const storeRef = useRef<LiveStore<T>>(null as never);

	if (!storeRef.current) {
		storeRef.current = createLiveStore(initialSnapshot);
	}

	useEffect(() => {
		storeRef.current.setSnapshot(initialSnapshot);
	}, [initialSnapshot]);

	return storeRef.current;
}

function useLiveSnapshot<T>(store: LiveStore<T>) {
	return useSyncExternalStore(
		store.subscribe,
		store.getSnapshot,
		store.getSnapshot,
	);
}

function useScheduledStoreRefresh<T>(
	store: LiveStore<T>,
	fetchValue: () => Promise<T>,
	getDelay: (value: T) => number,
) {
	const refreshValue = useEffectEvent(async () => {
		try {
			const nextValue = await fetchValue();

			startTransition(() => {
				store.setSnapshot(nextValue);
			});

			return nextValue;
		} catch {
			return store.getSnapshot();
		}
	});

	useEffect(() => {
		let timer: number | null = null;

		const scheduleNext = (delay: number) => {
			timer = window.setTimeout(async () => {
				const nextValue = await refreshValue();
				scheduleNext(getDelay(nextValue));
			}, delay);
		};

		scheduleNext(getDelay(store.getSnapshot()));

		return () => {
			if (timer !== null) {
				window.clearTimeout(timer);
			}
		};
	}, [getDelay, store]);
}

function WallStoreController({
	store,
}: {
	store: LiveStore<LiveWidgets["wall"]>;
}) {
	const fetchWall = useServerFn(getWallCollector);
	const refreshWall = useEffectEvent(async () => {
		try {
			const nextWall = await fetchWall();

			startTransition(() => {
				store.setSnapshot(nextWall);
			});
		} catch (error) {
			startTransition(() => {
				store.setSnapshot(buildWallRefreshFailure(store.getSnapshot(), error));
			});
		}
	});

	useEffect(() => {
		const timer = window.setInterval(() => {
			void refreshWall();
		}, WALL_REFRESH_MS);

		return () => {
			window.clearInterval(timer);
		};
	}, []);

	return null;
}

function AgendaStoreController({
	store,
}: {
	store: LiveStore<LiveWidgets["agenda"]>;
}) {
	const fetchAgenda = useServerFn(getWallAgenda);

	useScheduledStoreRefresh(store, fetchAgenda, getAgendaRefreshDelay);

	return null;
}

function WeatherStoreController({
	store,
}: {
	store: LiveStore<LiveWidgets["weather"]>;
}) {
	const fetchWeather = useServerFn(getWallWeather);

	useScheduledStoreRefresh(store, fetchWeather, getWeatherRefreshDelay);

	return null;
}

function NewsStoreController({
	store,
}: {
	store: LiveStore<LiveWidgets["newsFeed"]>;
}) {
	const fetchNewsFeed = useServerFn(getWallNewsFeed);

	useScheduledStoreRefresh(store, fetchNewsFeed, getNewsRefreshDelay);

	return null;
}

function getAgendaRefreshDelay(agenda: LiveWidgets["agenda"]) {
	return agenda.status === "loading"
		? AGENDA_REFRESH_LOADING_MS
		: AGENDA_REFRESH_OK_MS;
}

function getNewsRefreshDelay(newsFeed: LiveWidgets["newsFeed"]) {
	return newsFeed.status === "loading"
		? NEWS_REFRESH_LOADING_MS
		: NEWS_REFRESH_OK_MS;
}

function getWeatherRefreshDelay(weather: LiveWidgets["weather"]) {
	return weather.status === "loading"
		? WEATHER_REFRESH_LOADING_MS
		: WEATHER_REFRESH_OK_MS;
}

function buildWallRefreshFailure(
	wall: LiveWidgets["wall"],
	error: unknown,
): LiveWidgets["wall"] {
	const message =
		error instanceof Error ? error.message : "Systeemstatus kon niet verversen";

	if (wall.hosts.length > 0) {
		return {
			...wall,
			error: message,
			stale: true,
			statusLabel: "Wall-feed verouderd",
		};
	}

	return {
		...wall,
		status: "error",
		error: message,
		stale: false,
		generatedAt: "Systeemstatus niet beschikbaar",
		statusLabel: "Wall-feed fout",
		connectionLabel: "Hosts niet beschikbaar",
	};
}

function WallHero({ store }: { store: LiveStore<LiveWidgets["wall"]> }) {
	const wall = useLiveSnapshot(store);

	return (
		<div className="space-y-3">
			<p className="m-0 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
				Event wall
			</p>
			<div className="space-y-2">
				<h1 className="m-0 text-5xl font-semibold tracking-tight 2xl:text-6xl">
					Statusoverzicht
				</h1>
				<p className="m-0 text-xl text-muted-foreground 2xl:text-2xl">
					{wall.generatedAt}
				</p>
			</div>
		</div>
	);
}

function WallStatusChips({ store }: { store: LiveStore<LiveWidgets["wall"]> }) {
	const wall = useLiveSnapshot(store);

	return (
		<>
			<WallChip icon={<Rows3 className="size-4" />} label={wall.statusLabel} />
			<WallChip
				icon={<Cpu className="size-4" />}
				label={wall.connectionLabel}
			/>
		</>
	);
}

function NewsStatusChip({
	store,
}: {
	store: LiveStore<LiveWidgets["newsFeed"]>;
}) {
	const newsFeed = useLiveSnapshot(store);

	return (
		<WallChip
			icon={<Newspaper className="size-4" />}
			label={
				newsFeed.status === "live"
					? `${newsFeed.items.length} live koppen`
					: newsFeed.status === "loading"
						? "nieuws laden"
						: "nieuws fout"
			}
		/>
	);
}

function WeatherStatusChip({
	store,
}: {
	store: LiveStore<LiveWidgets["weather"]>;
}) {
	const weather = useLiveSnapshot(store);

	return (
		<WallChip
			icon={<SunMedium className="size-4" />}
			label={
				weather.status === "loading"
					? "weer laden"
					: weather.forecast
						? `${weather.forecast.length} dagen vooruitzicht${weather.stale ? " • verouderd" : ""}`
						: "weer offline"
			}
		/>
	);
}

function HostsPanelLive({ store }: { store: LiveStore<LiveWidgets["wall"]> }) {
	const wall = useLiveSnapshot(store);

	return <HostsPanel wall={wall} />;
}

function NewsPanelLive({
	store,
}: {
	store: LiveStore<LiveWidgets["newsFeed"]>;
}) {
	const newsFeed = useLiveSnapshot(store);

	return (
		<NewsPanel
			headlines={newsFeed.items}
			status={newsFeed.status}
			error={newsFeed.error}
		/>
	);
}

function AgendaPanelLive({
	store,
}: {
	store: LiveStore<LiveWidgets["agenda"]>;
}) {
	const agenda = useLiveSnapshot(store);

	return (
		<AgendaPanel
			agenda={agenda.items}
			status={agenda.status}
			error={agenda.error}
			stale={agenda.stale}
		/>
	);
}

function TasksPanelLive({
	store,
}: {
	store: LiveStore<LiveWidgets["agenda"]>;
}) {
	const agenda = useLiveSnapshot(store);

	return (
		<TasksPanel
			tasks={agenda.tasks}
			status={agenda.status}
			error={agenda.error}
			stale={agenda.stale}
		/>
	);
}

function WeatherPanelLive({
	store,
}: {
	store: LiveStore<LiveWidgets["weather"]>;
}) {
	const weather = useLiveSnapshot(store);

	return <WeatherPanel weather={weather} />;
}

function ClocksPanelLive({ initialClocks }: { initialClocks: ClockCard[] }) {
	const [clocks, setClocks] = useState(initialClocks);

	const updateClocks = useEffectEvent(() => {
		startTransition(() => {
			setClocks(buildClockCards(new Date()));
		});
	});

	useEffect(() => {
		updateClocks();

		const timer = window.setInterval(() => {
			updateClocks();
		}, CLOCK_REFRESH_MS);

		return () => {
			window.clearInterval(timer);
		};
	}, []);

	return (
		<Card className="h-full min-h-0 py-0">
			<CardHeader className="px-5 pt-4">
				<CardTitle className="text-2xl 2xl:text-3xl">Klokken</CardTitle>
			</CardHeader>
			<CardContent className="grid min-h-0 gap-3 overflow-y-auto px-5 pb-5">
				{clocks.map((clock) => (
					<div
						key={clock.label}
						className="flex items-center justify-between rounded-lg border px-4 py-4"
					>
						<div>
							<p className="m-0 text-base font-medium 2xl:text-xl">
								{clock.label}
							</p>
							<p className="m-0 text-sm text-muted-foreground 2xl:text-base">
								{clock.date}
							</p>
						</div>
						<div className="flex items-center gap-3">
							<Clock3 className="size-4 text-muted-foreground" />
							<span className="text-3xl font-semibold tracking-tight 2xl:text-4xl">
								{clock.time}
							</span>
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

function CalendarPanel({ agenda }: { agenda: LiveWidgets["agenda"] }) {
	const days = buildWallCalendar(new Date());
	const agendaDates = new Set(agenda.items.map((item) => item.dateIso));

	return (
		<div className="grid grid-cols-14 gap-x-2 gap-y-3 self-center px-2">
			{days.map((day, index) => (
				<div
					key={day.iso}
					className={[
						"relative text-center",
						day.isToday ? "text-primary" : "",
						day.isWeekend ? "text-muted-foreground/70" : "",
						day.isPastMonth && index < 14 ? "opacity-50" : "",
						day.isNextMonth && index >= 42 ? "opacity-50" : "",
					].join(" ")}
				>
					<p className="m-0 text-2xl font-semibold leading-none 2xl:text-3xl">
						{day.day}
					</p>
					{agendaDates.has(day.iso) ? (
						<div className="pointer-events-none absolute left-1/2 top-[calc(100%-0.1rem)] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-sky-400/90" />
					) : null}
				</div>
			))}
		</div>
	);
}

function WallChip({ icon, label }: { icon: React.ReactNode; label: string }) {
	return (
		<div className="flex min-h-16 items-center gap-3 rounded-lg border bg-card px-4 py-3 text-lg font-medium 2xl:text-xl">
			<div className="text-muted-foreground">{icon}</div>
			<span>{label}</span>
		</div>
	);
}

function HostsPanel({ wall }: { wall: LiveWidgets["wall"] }) {
	return (
		<Card className="h-full min-h-0 py-0">
			<CardHeader className="px-6 pt-5">
				<CardTitle className="text-3xl 2xl:text-4xl">Systeemstatus</CardTitle>
				<CardDescription className="text-lg 2xl:text-xl">
					{wall.status === "loading"
						? "Hosts worden op de achtergrond gecontroleerd."
						: wall.stale
							? "Laatste geldige hoststatus blijft zichtbaar totdat verversen weer lukt."
							: "Overzicht van de systemen. De agenda blijft de hoofdzaak."}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid min-h-0 overflow-y-auto px-6 pb-5">
				{wall.status === "loading" ? (
					<div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-4">
						<p className="m-0 text-lg font-medium text-sky-200 2xl:text-xl">
							Systeemstatus wordt geladen
						</p>
						<p className="m-0 mt-2 text-sm text-sky-100/80 2xl:text-base">
							De hosts worden opgehaald. Deze tegel vult zichzelf vanzelf.
						</p>
					</div>
				) : wall.status === "error" ? (
					<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-4">
						<p className="m-0 text-lg font-medium text-rose-300 2xl:text-xl">
							Systeemstatus niet beschikbaar
						</p>
						<p className="m-0 mt-2 text-sm text-rose-200/80 2xl:text-base">
							{wall.error ?? "De wall-hosts konden niet worden opgehaald."}
						</p>
					</div>
				) : (
					<div className="grid min-h-0 gap-4">
						{wall.stale && wall.error ? (
							<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-4">
								<p className="m-0 text-lg font-medium text-amber-300 2xl:text-xl">
									Systeemstatus is verouderd
								</p>
								<p className="m-0 mt-2 text-sm text-amber-200/80 2xl:text-base">
									{wall.error}
								</p>
							</div>
						) : null}
						<div className="grid min-h-0 grid-cols-2 gap-4">
							{wall.hosts.map((host) => {
								const loadValues = splitLoadValues(host.load);

								return (
									<div key={host.id} className="rounded-lg border p-4">
										<div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
											<div className="min-w-0">
												<p className="m-0 truncate text-xl font-medium 2xl:text-2xl">
													{host.name}
												</p>
												<p className="m-0 truncate text-sm text-muted-foreground 2xl:text-base">
													{host.role}
												</p>
												{host.error ? (
													<p className="m-0 mt-1 truncate text-xs text-rose-300 2xl:text-sm">
														{host.error}
													</p>
												) : null}
											</div>
											<Badge
												variant="outline"
												className={`shrink-0 text-sm 2xl:text-base ${toneClasses(host.state)}`}
											>
												{healthStateLabel(host.state)}
											</Badge>
										</div>
										<div className="mb-4 grid grid-cols-[1.15fr_0.95fr_0.95fr_0.95fr] gap-2 text-sm 2xl:text-base">
											<StatBlock label="Uptime" value={host.uptime} />
											{LOAD_WINDOWS.map((window, index) => (
												<StatBlock
													key={`${host.id}-load-${window}`}
													label={window}
													value={loadValues[index] ?? "n/a"}
													mono
												/>
											))}
										</div>
										<HostTemperatureChart host={host} />
										<div className="space-y-4">
											{host.metrics.map((metric) => (
												<MetricRow
													key={`${host.id}-${metric.label}`}
													metric={metric}
												/>
											))}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

const LOAD_WINDOWS = ["1m", "5m", "15m"] as const;

function splitLoadValues(load: string) {
	return load.split("/").map((value) => value.trim());
}

function StatBlock({
	label,
	value,
	mono = false,
}: {
	label: string;
	value: string;
	mono?: boolean;
}) {
	return (
		<div className="min-w-0">
			<p className="m-0 whitespace-nowrap text-[10px] uppercase tracking-[0.12em] text-muted-foreground 2xl:text-xs">
				{label}
			</p>
			<p
				className={[
					"mt-1 mb-0 whitespace-nowrap font-medium text-sm 2xl:text-base",
					mono ? "font-mono" : "",
				].join(" ")}
			>
				{value}
			</p>
		</div>
	);
}

function MetricRow({ metric }: { metric: HostMetric }) {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between text-base 2xl:text-lg">
				<span className="text-muted-foreground">{metric.label}</span>
				<span className="font-medium">{metric.value}</span>
			</div>
			<Progress value={metric.percent} className="h-3" />
		</div>
	);
}

function HostTemperatureChart({ host }: { host: HostStatus }) {
	const stroke = temperatureStroke(host.state);
	const sparklinePath = buildSparklinePath(host.cpuTempSeries);

	return (
		<div className="mb-4">
			<div className="mb-2 flex items-end justify-between">
				<p className="m-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground 2xl:text-xs">
					CPU temperatuur
				</p>
				<p className="m-0 font-mono text-lg font-medium 2xl:text-xl">
					{host.cpuTempC === null ? "n/a" : `${host.cpuTempC}°C`}
				</p>
			</div>
			<div className="h-16 w-full">
				{sparklinePath ? (
					<svg
						viewBox="0 0 100 32"
						preserveAspectRatio="none"
						className="h-full w-full"
						aria-hidden="true"
					>
						<path
							d={sparklinePath}
							fill="none"
							stroke={stroke}
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							vectorEffect="non-scaling-stroke"
						/>
					</svg>
				) : (
					<div className="h-full rounded-md border border-dashed border-border/60" />
				)}
			</div>
		</div>
	);
}

function AgendaPanel({
	agenda,
	status,
	error,
	stale,
}: {
	agenda: AgendaItem[];
	status: LiveWidgets["agenda"]["status"];
	error: string | null;
	stale: boolean;
}) {
	return (
		<Card className="h-full min-h-0 py-0">
			<CardHeader className="px-6 pt-5">
				<CardTitle className="text-2xl 2xl:text-3xl">Agenda</CardTitle>
				<CardDescription className="text-base 2xl:text-lg">
					{stale
						? "Tijdelijk verouderd. Laatste geldige agenda blijft zichtbaar."
						: "Eerstvolgende dingen op tijdvolgorde."}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid min-h-0 gap-4 overflow-y-auto px-6 pb-5">
				{status === "loading" ? (
					<div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-4">
						<p className="m-0 text-lg font-medium text-sky-200 2xl:text-xl">
							Agenda wordt geladen
						</p>
						<p className="m-0 mt-2 text-sm text-sky-100/80 2xl:text-base">
							CalDAV wordt op de achtergrond ververst. Deze tegel vult zichzelf
							vanzelf.
						</p>
					</div>
				) : status === "error" ? (
					<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-4">
						<p className="m-0 text-lg font-medium text-rose-300 2xl:text-xl">
							Agenda niet beschikbaar
						</p>
						<p className="m-0 mt-2 text-sm text-rose-200/80 2xl:text-base">
							{error ?? "Geen live agenda-data beschikbaar."}
						</p>
					</div>
				) : (
					agenda.map((item) => (
						<div
							key={item.id}
							className={[
								"grid grid-cols-[minmax(0,1fr)_7.5rem] gap-4 rounded-lg border p-5",
								item.isPast ? "border-muted/70 opacity-70" : "",
							].join(" ")}
						>
							<div className="min-w-0">
								<p className="m-0 text-xs uppercase tracking-[0.18em] text-muted-foreground 2xl:text-sm">
									{item.dateLabel}
								</p>
								<div className="mt-2 space-y-1">
									<p className="m-0 text-xs uppercase tracking-[0.16em] text-sky-300/80 2xl:text-sm">
										{item.calendar}
									</p>
									<p className="m-0 text-xl font-medium leading-tight text-balance 2xl:text-2xl">
										{item.title}
									</p>
									<p className="m-0 text-sm leading-6 text-muted-foreground 2xl:text-base">
										{item.context}
									</p>
								</div>
							</div>
							<div className="flex flex-col items-end justify-start text-right leading-none">
								<p className="m-0 text-3xl font-semibold tracking-tight 2xl:text-4xl">
									{item.isAllDay ? "Hele" : item.time}
								</p>
								<p className="m-0 mt-1 text-lg text-muted-foreground 2xl:text-xl">
									{item.isAllDay ? "dag" : (item.endTime ?? "")}
								</p>
							</div>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

function NewsPanel({
	headlines,
	status,
	error,
}: {
	headlines: Headline[];
	status: LiveWidgets["newsFeed"]["status"];
	error: string | null;
}) {
	const pages = chunkHeadlines(headlines, NEWS_PAGE_SIZE);
	const [pageIndex, setPageIndex] = useState(0);
	const headlineCount = headlines.length;

	useEffect(() => {
		if (headlineCount === 0) {
			setPageIndex(0);
			return;
		}

		setPageIndex(0);
	}, [headlineCount]);

	useEffect(() => {
		if (pages.length <= 1) return;

		const timer = window.setInterval(() => {
			startTransition(() => {
				setPageIndex((current) => (current + 1) % pages.length);
			});
		}, NEWS_PAGE_INTERVAL_MS);

		return () => {
			window.clearInterval(timer);
		};
	}, [pages.length]);

	const visibleHeadlines = pages[pageIndex] ?? [];

	return (
		<Card className="h-full min-h-0 py-0">
			<CardHeader className="px-5 pt-4">
				<div className="flex items-start justify-between gap-4">
					<div>
						<CardTitle className="text-2xl 2xl:text-3xl">Nieuws</CardTitle>
						<CardDescription className="text-base 2xl:text-lg">
							{status === "live"
								? "Live uit FreshRSS. Kort, scanbaar en ondergeschikt aan de agenda."
								: status === "loading"
									? "Nieuws wordt op de achtergrond ververst en verschijnt vanzelf."
									: "Geen live nieuws beschikbaar."}
						</CardDescription>
					</div>
					{pages.length > 1 ? (
						<div className="pt-1 text-sm tabular-nums text-muted-foreground 2xl:text-base">
							{pageIndex + 1} / {pages.length}
						</div>
					) : null}
				</div>
			</CardHeader>
			<CardContent className="grid min-h-0 gap-3 overflow-y-auto px-5 pb-5">
				{status === "error" ? (
					<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-4">
						<p className="m-0 text-lg font-medium text-rose-300 2xl:text-xl">
							Nieuws niet beschikbaar
						</p>
						<p className="m-0 mt-2 text-sm text-rose-200/80 2xl:text-base">
							{error ?? "FreshRSS gaf geen live nieuws terug."}
						</p>
					</div>
				) : status === "loading" ? (
					<div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-4">
						<p className="m-0 text-lg font-medium text-sky-200 2xl:text-xl">
							Nieuws wordt geladen
						</p>
						<p className="m-0 mt-2 text-sm text-sky-100/80 2xl:text-base">
							FreshRSS wordt op de achtergrond opgehaald. Deze tegel ververst
							automatisch.
						</p>
					</div>
				) : (
					visibleHeadlines.map((headline) => (
						<div
							key={headline.id}
							className={[
								"gap-4 rounded-lg border p-4",
								headline.imageSrc
									? "grid grid-cols-[7.5rem_minmax(0,1fr)] 2xl:grid-cols-[8rem_minmax(0,1fr)]"
									: "block",
							].join(" ")}
						>
							{headline.imageSrc ? (
								<img
									src={headline.imageSrc}
									alt=""
									className="h-20 w-30 rounded-md object-cover 2xl:h-24 2xl:w-32"
								/>
							) : null}
							<div className="min-w-0 space-y-3">
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="outline" className="text-xs 2xl:text-sm">
										{headline.source}
									</Badge>
									<Badge variant="outline" className="text-xs 2xl:text-sm">
										{headline.category}
									</Badge>
									<Badge
										variant="outline"
										className={`text-xs 2xl:text-sm ${newsPriorityTone(headline.priority)}`}
									>
										{headline.priority}
									</Badge>
									<span className="text-xs text-muted-foreground 2xl:text-sm">
										{headline.age}
									</span>
								</div>
								<p className="m-0 line-clamp-2 text-xl font-medium leading-tight 2xl:text-2xl">
									{headline.title}
								</p>
								<p className="m-0 line-clamp-2 text-sm leading-6 text-muted-foreground 2xl:text-base">
									{headline.summary}
								</p>
							</div>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

function TasksPanel({
	tasks,
	status,
	error,
	stale,
}: {
	tasks: AgendaTask[];
	status: LiveWidgets["agenda"]["status"];
	error: string | null;
	stale: boolean;
}) {
	return (
		<Card className="h-full min-h-0 py-0">
			<CardHeader className="px-5 pt-4">
				<div className="flex items-start justify-between gap-4">
					<div>
						<CardTitle className="text-2xl 2xl:text-3xl">Taken</CardTitle>
						<CardDescription className="text-base 2xl:text-lg">
							{stale
								? "Tijdelijk verouderd. Laatste geldige taken blijven zichtbaar."
								: "Live uit dezelfde CalDAV-bron als de agenda."}
						</CardDescription>
					</div>
					<ListTodo className="mt-1 size-5 text-muted-foreground" />
				</div>
			</CardHeader>
			<CardContent className="grid min-h-0 gap-3 overflow-y-auto px-5 pb-5">
				{status === "loading" && tasks.length === 0 ? (
					<div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-4">
						<p className="m-0 text-lg font-medium text-sky-200 2xl:text-xl">
							Taken worden geladen
						</p>
						<p className="m-0 mt-2 text-sm text-sky-100/80 2xl:text-base">
							CalDAV-taken worden op de achtergrond opgehaald.
						</p>
					</div>
				) : status === "error" && tasks.length === 0 ? (
					<div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-4">
						<p className="m-0 text-lg font-medium text-rose-300 2xl:text-xl">
							Taken niet beschikbaar
						</p>
						<p className="m-0 mt-2 text-sm text-rose-200/80 2xl:text-base">
							{error ?? "Geen live taken beschikbaar."}
						</p>
					</div>
				) : tasks.length === 0 ? (
					<div className="rounded-lg border border-muted/70 px-4 py-4">
						<p className="m-0 text-lg font-medium 2xl:text-xl">
							Geen open taken
						</p>
						<p className="m-0 mt-2 text-sm text-muted-foreground 2xl:text-base">
							Er kwamen geen open CalDAV-taken terug uit dezelfde bron als de
							agenda.
						</p>
					</div>
				) : (
					tasks.map((task) => (
						<div key={task.id} className="rounded-lg border p-4">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="m-0 text-lg font-medium 2xl:text-xl">
										{task.title}
									</p>
									<p className="m-0 mt-2 text-sm leading-6 text-muted-foreground 2xl:text-base">
										{task.context}
									</p>
								</div>
								<Badge
									variant="outline"
									className={`shrink-0 text-xs 2xl:text-sm ${workToneClasses(taskTone(task))}`}
								>
									{task.statusLabel}
								</Badge>
							</div>
							<p className="m-0 mt-4 text-xs uppercase tracking-[0.16em] text-muted-foreground 2xl:text-sm">
								{task.calendar} • {task.dueLabel}
							</p>
						</div>
					))
				)}
			</CardContent>
		</Card>
	);
}

function EmailPanel() {
	return (
		<Card className="h-full min-h-0 py-0">
			<CardHeader className="px-5 pt-4">
				<div className="flex items-start justify-between gap-4">
					<div>
						<CardTitle className="text-2xl 2xl:text-3xl">Email</CardTitle>
						<CardDescription className="text-base 2xl:text-lg">
							Compacte inbox met alleen de threads die tijd, contact of taken
							sturen.
						</CardDescription>
					</div>
					<Mail className="mt-1 size-5 text-muted-foreground" />
				</div>
			</CardHeader>
			<CardContent className="grid min-h-0 gap-3 overflow-y-auto px-5 pb-5">
				{EMAIL_ITEMS.map((email) => (
					<div key={email.id} className="rounded-lg border p-4">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="m-0 text-xs uppercase tracking-[0.16em] text-muted-foreground 2xl:text-sm">
									{email.from}
								</p>
								<p className="m-0 mt-2 text-lg font-medium leading-tight 2xl:text-xl">
									{email.subject}
								</p>
							</div>
							<Badge
								variant="outline"
								className={`shrink-0 text-xs 2xl:text-sm ${workToneClasses(email.tone)}`}
							>
								{email.age}
							</Badge>
						</div>
						<p className="m-0 mt-3 text-sm leading-6 text-muted-foreground 2xl:text-base">
							{email.preview}
						</p>
					</div>
				))}
			</CardContent>
		</Card>
	);
}

function AssistantPanel({
	wall,
	agenda,
	newsFeed,
	weather,
}: {
	wall: LiveWidgets["wall"];
	agenda: LiveWidgets["agenda"];
	newsFeed: LiveWidgets["newsFeed"];
	weather: LiveWidgets["weather"];
}) {
	const nextAgendaItem = agenda.items.find((item) => !item.isPast);
	const hostsNeedingAttention = wall.hosts.filter(
		(host) => host.state !== "healthy",
	);
	const suggestedActions = buildAssistantActions({
		wall,
		agenda,
		newsFeed,
		weather,
		nextAgendaItem,
		hostsNeedingAttention,
	});

	return (
		<Card className="h-full min-h-0 py-0">
			<CardHeader className="px-5 pt-4">
				<div className="flex items-start justify-between gap-4">
						<div>
							<CardTitle className="text-2xl 2xl:text-3xl">Assistent</CardTitle>
							<CardDescription className="text-base 2xl:text-lg">
								Beheert agenda, email en taken als één werkstroom.
							</CardDescription>
						</div>
					<Bot className="mt-1 size-5 text-muted-foreground" />
				</div>
			</CardHeader>
			<CardContent className="grid min-h-0 gap-4 overflow-y-auto px-5 pb-5">
				<div className="rounded-lg border px-4 py-4">
					<div className="flex items-start gap-3">
						<div className="rounded-full border p-2 text-primary">
							<Sparkles className="size-5" />
						</div>
						<div>
							<p className="m-0 text-lg font-medium 2xl:text-xl">
								Regie voor de volgende beweging
							</p>
							<p className="m-0 mt-2 text-sm leading-6 text-muted-foreground 2xl:text-base">
								{nextAgendaItem
									? `Volgende harde afspraak: ${nextAgendaItem.title} om ${nextAgendaItem.time}.`
									: "Er staat nog geen harde afspraak op korte termijn vast."}
							</p>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-3">
					<AssistantStat
						label="Agenda"
						value={nextAgendaItem ? nextAgendaItem.timeLabel : "Geen blok"}
					/>
					<AssistantStat
						label="Hosts"
						value={
							hostsNeedingAttention.length > 0
								? `${hostsNeedingAttention.length} vragen aandacht`
								: "Alles rustig"
						}
						tone={hostsNeedingAttention.length > 0 ? "watch" : "ok"}
					/>
					<AssistantStat
						label="Inbox"
						value={`${EMAIL_ITEMS.filter((item) => item.tone !== "ok").length} prioriteit`}
						tone="focus"
					/>
					<AssistantStat
						label="Taken"
						value={`${agenda.tasks.length} open`}
						tone="plan"
					/>
				</div>

				<div className="rounded-lg border p-4">
					<div className="mb-3 flex items-center gap-2">
						<TriangleAlert className="size-4 text-muted-foreground" />
						<p className="m-0 text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
							Aanbevolen nu
						</p>
					</div>
					<div className="space-y-3">
						{suggestedActions.map((action) => (
							<div key={action.label} className="rounded-md border px-3 py-3">
								<div className="flex items-start justify-between gap-3">
									<p className="m-0 text-sm font-medium 2xl:text-base">
										{action.label}
									</p>
									<Badge
										variant="outline"
										className={`shrink-0 text-xs 2xl:text-sm ${workToneClasses(action.tone)}`}
									>
										{action.tag}
									</Badge>
								</div>
								<p className="m-0 mt-2 text-sm leading-6 text-muted-foreground 2xl:text-base">
									{action.detail}
								</p>
							</div>
						))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function AssistantStat({
	label,
	value,
	tone = "ok",
}: {
	label: string;
	value: string;
	tone?: WorkTone;
}) {
	return (
		<div
			className={`rounded-lg border px-3 py-3 ${workToneSurfaceClasses(tone)}`}
		>
			<p className="m-0 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
				{label}
			</p>
			<p className="m-0 mt-2 text-sm font-medium leading-6 2xl:text-base">
				{value}
			</p>
		</div>
	);
}

function WeatherPanel({ weather }: { weather: LiveWidgets["weather"] }) {
	return (
		<Card className="h-full min-h-0 py-0">
			<CardHeader className="px-5 pt-4">
				<CardTitle className="text-2xl 2xl:text-3xl">Weer</CardTitle>
				{weather.status === "loading" ? (
					<CardDescription className="text-sm 2xl:text-base">
						Weerdata wordt op de achtergrond opgehaald.
					</CardDescription>
				) : weather.stale && weather.forecast ? (
					<CardDescription className="text-sm 2xl:text-base">
						Tijdelijk verouderd. Laatste geldige data blijft zichtbaar.
					</CardDescription>
				) : null}
			</CardHeader>
			<CardContent className="grid min-h-0 gap-3 overflow-y-auto px-5 pb-5">
				{weather.status === "loading" ? (
					<div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-4">
						<p className="m-0 text-lg font-medium text-sky-200 2xl:text-xl">
							Weer wordt geladen
						</p>
						<p className="m-0 mt-2 text-sm text-sky-100/80 2xl:text-base">
							Open-Meteo wordt in de achtergrond ververst. Deze tegel vult
							zichzelf vanzelf.
						</p>
					</div>
				) : weather.forecast ? (
					weather.forecast.map((item) => (
						<div
							key={item.day}
							className="flex items-center justify-between rounded-lg border px-4 py-3"
						>
							<div className="flex items-center gap-3">
								<div className="flex size-12 items-center justify-center rounded-full bg-muted/35 text-4xl text-primary 2xl:size-14 2xl:text-5xl">
									{(() => {
										const WeatherIcon = weatherCodeIcon(item.code ?? 3);

										return <WeatherIcon />;
									})()}
								</div>
								<div>
									<p className="m-0 text-lg font-medium 2xl:text-xl">
										{item.day}
									</p>
									<p className="m-0 text-sm text-muted-foreground 2xl:text-base">
										{item.condition}
									</p>
								</div>
							</div>
							<p className="m-0 text-xl font-semibold 2xl:text-2xl">
								{item.high} / {item.low}
							</p>
						</div>
					))
				) : (
					<div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-4">
						<p className="m-0 text-lg font-medium text-amber-300 2xl:text-xl">
							Weerdata niet beschikbaar
						</p>
						<p className="m-0 mt-2 text-sm text-amber-200/80 2xl:text-base">
							{weather.error ?? "Geen verbinding met de weerbron."}
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function workToneClasses(tone: WorkTone) {
	switch (tone) {
		case "focus":
			return "border-rose-500/30 bg-rose-500/10 text-rose-300";
		case "watch":
			return "border-amber-500/30 bg-amber-500/10 text-amber-300";
		case "plan":
			return "border-sky-500/30 bg-sky-500/10 text-sky-300";
		case "ok":
			return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
	}
}

function taskTone(task: AgendaTask): WorkTone {
	if (task.isOverdue) {
		return "focus";
	}

	if (task.statusLabel === "Bezig") {
		return "watch";
	}

	if (task.dueIso) {
		return "plan";
	}

	return "ok";
}

function workToneSurfaceClasses(tone: WorkTone) {
	switch (tone) {
		case "focus":
			return "border-rose-500/20 bg-rose-500/6";
		case "watch":
			return "border-amber-500/20 bg-amber-500/6";
		case "plan":
			return "border-sky-500/20 bg-sky-500/6";
		case "ok":
			return "border-emerald-500/20 bg-emerald-500/6";
	}
}

function buildAssistantActions({
	wall,
	agenda,
	newsFeed,
	weather,
	nextAgendaItem,
	hostsNeedingAttention,
}: {
	wall: LiveWidgets["wall"];
	agenda: LiveWidgets["agenda"];
	newsFeed: LiveWidgets["newsFeed"];
	weather: LiveWidgets["weather"];
	nextAgendaItem: AgendaItem | undefined;
	hostsNeedingAttention: HostStatus[];
}): Array<{
	label: string;
	detail: string;
	tag: string;
	tone: WorkTone;
}> {
	return [
		{
			label: "Agenda in positie zetten",
			detail: nextAgendaItem
				? `${nextAgendaItem.title} staat als volgende gepland. Reserveer voorbereiding en verplaats alles wat daarvoor stoort.`
				: agenda.status === "loading"
					? "De agenda ververst nog. Houd ruimte vrij totdat de volgende afspraak scherp is."
					: "Er is ruimte om nieuwe blokken in te plannen zonder een bestaande afspraak te breken.",
			tag: nextAgendaItem
				? "Agenda"
				: agenda.status === "loading"
					? "Sync"
					: "Ruimte",
			tone: nextAgendaItem
				? "focus"
				: agenda.status === "loading"
					? "watch"
					: "ok",
		},
		{
			label: "Technische aandacht bundelen",
			detail:
				hostsNeedingAttention.length > 0
					? `${hostsNeedingAttention.length} host(s) vragen aandacht. Maak hier één checkpoint van in plaats van losse pings.`
					: `${wall.connectionLabel}. Er is nu geen acuut systeemwerk nodig.`,
			tag: hostsNeedingAttention.length > 0 ? "Hosts" : "Rust",
			tone: hostsNeedingAttention.length > 0 ? "watch" : "ok",
		},
		{
			label: "Communicatie ritme bewaken",
			detail:
				newsFeed.status === "live"
					? `${EMAIL_ITEMS.filter((item) => item.tone !== "ok").length} mailthreads en ${newsFeed.items.length} live nieuwsitems concurreren om aandacht. Laat de assistent eerst filteren.`
					: "De inbox heeft nog steeds prioriteitswerk, maar het nieuws hoeft nu geen aandacht.",
			tag: "Inbox",
			tone: "plan",
		},
		{
			label: "Context van vandaag bewaken",
			detail:
				weather.status === "live" && weather.forecast?.[0]
					? `Weer voor vandaag: ${weather.forecast[0].condition}, ${weather.forecast[0].high}/${weather.forecast[0].low}. Gebruik dit voor reistijd en voorbereiding.`
					: "Weerdata ontbreekt of ververst nog; houd marge in de dagplanning.",
			tag: "Context",
			tone: "ok",
		},
	];
}

function buildWallCalendar(referenceDate: Date) {
	const firstOfMonth = startOfMonth(referenceDate);
	const start = startOfWeek(firstOfMonth, { weekStartsOn: 1 });
	const days = eachDayOfInterval({ start, end: addDays(start, 55) });

	return days.map((current) => {
		return {
			iso: formatISO(current, { representation: "date" }),
			day: format(current, "d"),
			isWeekend: isWeekend(current),
			isToday: isSameDay(current, referenceDate),
			isPastMonth:
				!isSameMonth(current, referenceDate) &&
				isBefore(current, referenceDate),
			isNextMonth:
				!isSameMonth(current, referenceDate) &&
				!isBefore(current, referenceDate),
		};
	});
}

async function getLiveWidgets(): Promise<LiveWidgets> {
	const now = new Date();
	const [wall, agenda, weather, newsFeed] = await Promise.all([
		getWallCollector(),
		getWallAgenda(),
		getWallWeather(),
		getWallNewsFeed(),
	]);

	return {
		wall,
		agenda,
		clocks: buildClockCards(now),
		weather,
		newsFeed,
	};
}

function buildClockCards(now: Date) {
	return CLOCKS.map((clock) => ({
		label: clock.label,
		time: new Intl.DateTimeFormat("nl-NL", {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
			timeZone: clock.timeZone,
		}).format(now),
		date: new Intl.DateTimeFormat("nl-NL", {
			weekday: "short",
			day: "2-digit",
			month: "short",
			timeZone: clock.timeZone,
		})
			.format(now)
			.replaceAll(".", ""),
	}));
}

function weatherCodeIcon(code: number): IconType {
	if (code === 0) return WiDaySunny;
	if (code === 1) return WiDaySunny;
	if (code === 2) return WiDayCloudy;
	if (code === 3) return WiCloudy;
	if (code === 45 || code === 48) return WiFog;
	if (code >= 51 && code <= 55) return WiSprinkle;
	if (code === 56 || code === 57) return WiSleet;
	if (code >= 61 && code <= 65) return WiRain;
	if (code === 66 || code === 67) return WiHail;
	if (code >= 71 && code <= 77) return WiSnow;
	if (code === 80) return WiDayCloudyGusts;
	if (code === 81 || code === 82) return WiShowers;
	if (code >= 85 && code <= 86) return WiSnow;
	if (code >= 95) return WiThunderstorm;

	return WiCloud;
}

function temperatureStroke(state: HealthState) {
	switch (state) {
		case "healthy":
			return "hsl(142 76% 45%)";
		case "warning":
			return "hsl(38 92% 50%)";
		case "critical":
			return "hsl(0 84% 60%)";
	}
}

function buildSparklinePath(values: number[]) {
	if (values.length === 0) {
		return "";
	}

	const width = 100;
	const height = 32;
	const inset = 2;
	const minValue = Math.min(...values);
	const maxValue = Math.max(...values);
	const range = Math.max(maxValue - minValue, 1);

	return values
		.map((value, index) => {
			const x =
				values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
			const y =
				height - inset - ((value - minValue) / range) * (height - inset * 2);

			return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
		})
		.join(" ");
}

function chunkHeadlines(headlines: Headline[], pageSize: number) {
	const pages: Headline[][] = [];

	for (let index = 0; index < headlines.length; index += pageSize) {
		pages.push(headlines.slice(index, index + pageSize));
	}

	return pages;
}

function newsPriorityTone(priority: Headline["priority"]) {
	switch (priority) {
		case "hoog":
			return "border-rose-500/30 bg-rose-500/10 text-rose-300";
		case "normaal":
			return "border-sky-500/30 bg-sky-500/10 text-sky-300";
		case "laag":
			return "border-muted bg-muted/40 text-muted-foreground";
	}
}
