--
-- PostgreSQL database dump
--

\restrict lF5Zx4tfPDzSWnkiJkOAWC6lhCl5v4G4ykkpBRw6qib6bcQDEW5bv50eEy1i43F

-- Dumped from database version 18.4 (Postgres.app)
-- Dumped by pg_dump version 18.4 (Postgres.app)

-- Started on 2026-06-06 12:05:46 +03

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 224 (class 1259 OID 16429)
-- Name: admins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.admins (
    id bigint NOT NULL,
    registration_id bigint,
    login text NOT NULL,
    password_hash text NOT NULL,
    role text DEFAULT 'admin'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admins OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16428)
-- Name: admins_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.admins ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.admins_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 230 (class 1259 OID 16498)
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    actor_type text NOT NULL,
    actor_id bigint,
    actor_login text,
    action text NOT NULL,
    entity_table text NOT NULL,
    entity_id bigint,
    changes jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 16497)
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.audit_logs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 226 (class 1259 OID 16455)
-- Name: balances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.balances (
    id bigint NOT NULL,
    registration_id bigint NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    currency character(3) DEFAULT 'BYN'::bpchar NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.balances OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 16454)
-- Name: balances_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.balances ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.balances_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 228 (class 1259 OID 16477)
-- Name: debtors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.debtors (
    id bigint NOT NULL,
    registration_id bigint NOT NULL,
    debt_amount numeric(12,2) DEFAULT 0 NOT NULL,
    reason text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone
);


ALTER TABLE public.debtors OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 16476)
-- Name: debtors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.debtors ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.debtors_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 232 (class 1259 OID 16514)
-- Name: password_reset_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_codes (
    id bigint NOT NULL,
    registration_id bigint NOT NULL,
    email text NOT NULL,
    code_hash text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.password_reset_codes OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 16513)
-- Name: password_reset_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.password_reset_codes ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.password_reset_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 222 (class 1259 OID 16408)
-- Name: personalization_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.personalization_data (
    id bigint NOT NULL,
    registration_id bigint NOT NULL,
    full_name text,
    birth_date date,
    phone text,
    email text,
    residential_address text,
    registration_address text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.personalization_data OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16407)
-- Name: personalization_data_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.personalization_data ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.personalization_data_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 220 (class 1259 OID 16391)
-- Name: registration_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.registration_data (
    id bigint NOT NULL,
    fio text NOT NULL,
    login text NOT NULL,
    street text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.registration_data OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16390)
-- Name: registration_data_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.registration_data ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.registration_data_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 234 (class 1259 OID 16536)
-- Name: telegram_payment_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.telegram_payment_orders (
    id bigint NOT NULL,
    registration_id bigint NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character(3) DEFAULT 'BYN'::bpchar NOT NULL,
    payment_method text DEFAULT 'telegram_provider'::text NOT NULL,
    invoice_currency character(3) DEFAULT 'BYN'::bpchar NOT NULL,
    invoice_amount integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'created'::text NOT NULL,
    telegram_payload text NOT NULL,
    telegram_chat_id bigint,
    telegram_username text,
    description text,
    telegram_payment_charge_id text,
    provider_payment_charge_id text,
    raw_update jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_sent_at timestamp with time zone,
    paid_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    CONSTRAINT telegram_payment_orders_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT telegram_payment_orders_invoice_amount_check CHECK ((invoice_amount >= 0)),
    CONSTRAINT telegram_payment_orders_payment_method_check CHECK ((payment_method = ANY (ARRAY['telegram_provider'::text, 'telegram_stars'::text]))),
    CONSTRAINT telegram_payment_orders_status_check CHECK ((status = ANY (ARRAY['created'::text, 'invoice_sent'::text, 'paid'::text, 'failed'::text, 'cancelled'::text])))
);


ALTER TABLE public.telegram_payment_orders OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 16535)
-- Name: telegram_payment_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.telegram_payment_orders ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.telegram_payment_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 3819 (class 0 OID 16429)
-- Dependencies: 224
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.admins (id, registration_id, login, password_hash, role, is_active, created_at) FROM stdin;
1	\N	admin	$2b$10$ItCyxCA90mx81IHf7fbn5eM7mtiVtGpcxMKMAV3/BoHKexQ8/.7R.	admin	t	2026-06-04 18:51:26.007837+03
2	1	root	$2b$10$Vf3u.VQOmQHb3xKYllSEXegZr2aSOtJfV9w5sq1kem54ixCyNW/ia	admin	t	2026-06-05 11:08:06.121074+03
\.


--
-- TOC entry 3825 (class 0 OID 16498)
-- Dependencies: 230
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, actor_type, actor_id, actor_login, action, entity_table, entity_id, changes, ip_address, created_at) FROM stdin;
1	user	1	root	user_register	registration_data	1	{"after": {"id": "1", "fio": "Aa", "login": "root", "street": "Ул. Брестская283а"}}	::1	2026-06-04 19:16:38.401946+03
2	system	1	root	seed_user_upsert	registration_data	1	{"seed": true, "after": {"fio": "Системный администратор", "login": "root", "street": "ул. Брестская, 12"}}	127.0.0.1	2026-06-05 11:08:06.121074+03
3	system	3	ivan.petrov	seed_user_upsert	registration_data	3	{"seed": true, "after": {"fio": "Иван Петров", "login": "ivan.petrov", "street": "ул. Фроленкова, 8"}}	127.0.0.1	2026-06-05 11:08:06.121074+03
4	system	4	maria.kovaleva	seed_user_upsert	registration_data	4	{"seed": true, "after": {"fio": "Мария Ковалева", "login": "maria.kovaleva", "street": "ул. Кирова, 21"}}	127.0.0.1	2026-06-05 11:08:06.121074+03
5	system	5	pavel.romanov	seed_user_upsert	registration_data	5	{"seed": true, "after": {"fio": "Павел Романов", "login": "pavel.romanov", "street": "ул. Жукова, 14"}}	127.0.0.1	2026-06-05 11:08:06.121074+03
6	system	6	olga.sokolova	seed_user_upsert	registration_data	6	{"seed": true, "after": {"fio": "Ольга Соколова", "login": "olga.sokolova", "street": "ул. Лисина, 5"}}	127.0.0.1	2026-06-05 11:08:06.121074+03
7	system	7	dmitry.antonov	seed_user_upsert	registration_data	7	{"seed": true, "after": {"fio": "Дмитрий Антонов", "login": "dmitry.antonov", "street": "ул. Советская, 36"}}	127.0.0.1	2026-06-05 11:08:06.121074+03
8	system	1	root	seed_root_admin_ready	admins	2	{"role": "admin", "seed": true, "login": "root"}	127.0.0.1	2026-06-05 11:08:06.121074+03
9	admin	2	root	balance_auto_debtor_created	debtors	5	{"after": {"reason": "Автоматически создано: отрицательный баланс", "is_active": true, "debt_amount": 31.2, "registration_id": "7"}}	::1	2026-06-05 11:14:04.724736+03
10	admin	2	root	admin_update	balances	7	{"amount": {"to": "-31.20", "from": "214.65"}}	::1	2026-06-05 11:14:04.724736+03
11	admin	2	root	balance_auto_debtor_closed	debtors	5	{"after": {"reason": "Автоматически создано: отрицательный баланс", "is_active": false, "debt_amount": 0}, "before": [{"id": "5", "debt_amount": "31.20"}]}	::1	2026-06-05 11:14:27.891113+03
12	admin	2	root	admin_update	balances	7	{"amount": {"to": "20.00", "from": "-31.20"}}	::1	2026-06-05 11:14:27.891113+03
13	admin	2	root	balance_auto_debtor_created	debtors	6	{"after": {"reason": "Автоматически создано: отрицательный баланс", "is_active": true, "debt_amount": 31.2, "registration_id": "7"}}	::1	2026-06-05 11:14:27.922352+03
14	admin	2	root	admin_update	balances	7	{"amount": {"to": "-31.20", "from": "20.00"}}	::1	2026-06-05 11:14:27.922352+03
15	user	8	123	user_register	registration_data	8	{"after": {"id": "8", "fio": "ПП", "login": "123", "street": "123"}}	::1	2026-06-05 11:32:36.002232+03
16	admin	2	root	admin_update	personalization_data	4	{"birth_date": {"to": "1992-07-22T21:00:00.000Z", "from": "1992-07-23T21:00:00.000Z"}, "registration_address": {"to": "г. Барановичи, ул. Кирова, 212", "from": "г. Барановичи, ул. Кирова, 21"}}	::1	2026-06-05 11:46:53.220756+03
\.


--
-- TOC entry 3821 (class 0 OID 16455)
-- Dependencies: 226
-- Data for Name: balances; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.balances (id, registration_id, amount, currency, updated_at) FROM stdin;
1	1	125.40	BYN	2026-06-05 11:08:06.121074+03
3	3	48.25	BYN	2026-06-05 11:08:06.121074+03
4	4	73.10	BYN	2026-06-05 11:08:06.121074+03
5	5	12.00	BYN	2026-06-05 11:08:06.121074+03
6	6	0.00	BYN	2026-06-05 11:08:06.121074+03
7	7	-31.20	BYN	2026-06-05 11:14:27.922352+03
8	8	0.00	BYN	2026-06-05 11:32:36.002232+03
\.


--
-- TOC entry 3823 (class 0 OID 16477)
-- Dependencies: 228
-- Data for Name: debtors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.debtors (id, registration_id, debt_amount, reason, is_active, created_at, closed_at) FROM stdin;
1	4	18.45	Задолженность за холодное водоснабжение	t	2026-06-05 11:08:06.121074+03	\N
2	5	42.80	Просроченная оплата за водоотведение	t	2026-06-05 11:08:06.121074+03	\N
3	6	9.10	Пени за несвоевременную оплату	t	2026-06-05 11:08:06.121074+03	\N
4	3	15.00	Закрытая задолженность за прошлый период	f	2026-06-05 11:08:06.121074+03	2026-05-20 09:00:00+03
5	7	0.00	Автоматически создано: отрицательный баланс	f	2026-06-05 11:14:04.724736+03	2026-06-05 11:14:27.891113+03
6	7	31.20	Автоматически создано: отрицательный баланс	t	2026-06-05 11:14:27.922352+03	\N
\.


--
-- TOC entry 3827 (class 0 OID 16514)
-- Dependencies: 232
-- Data for Name: password_reset_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_reset_codes (id, registration_id, email, code_hash, attempts, expires_at, used_at, created_at) FROM stdin;
1	4	maria.kovaleva@example.com	seed-reset-hash-maria-001	0	2026-06-05 20:00:00+03	\N	2026-06-05 11:08:06.121074+03
2	6	olga.sokolova@example.com	seed-reset-hash-olga-001	0	2026-06-04 20:00:00+03	2026-06-04 19:30:00+03	2026-06-05 11:08:06.121074+03
\.


--
-- TOC entry 3817 (class 0 OID 16408)
-- Dependencies: 222
-- Data for Name: personalization_data; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.personalization_data (id, registration_id, full_name, birth_date, phone, email, residential_address, registration_address, created_at, updated_at) FROM stdin;
1	1	Системный администратор	1990-01-15	+375 29 100-00-01	root@barvodokanal.by	г. Барановичи, ул. Брестская, 12	г. Барановичи, ул. Брестская, 12	2026-06-04 19:16:38.401946+03	2026-06-05 11:08:06.121074+03
3	3	Петров Иван Сергеевич	1986-03-11	+375 29 215-43-10	ivan.petrov@example.com	г. Барановичи, ул. Фроленкова, 8	г. Барановичи, ул. Фроленкова, 8	2026-06-05 11:08:06.121074+03	2026-06-05 11:08:06.121074+03
5	5	Романов Павел Викторович	1979-11-02	+375 44 392-76-40	pavel.romanov@example.com	г. Барановичи, ул. Жукова, 14	г. Барановичи, ул. Жукова, 14	2026-06-05 11:08:06.121074+03	2026-06-05 11:08:06.121074+03
6	6	Соколова Ольга Николаевна	1988-05-19	+375 25 508-19-33	olga.sokolova@example.com	г. Барановичи, ул. Лисина, 5	г. Барановичи, ул. Лисина, 5	2026-06-05 11:08:06.121074+03	2026-06-05 11:08:06.121074+03
7	7	Антонов Дмитрий Игоревич	1995-09-06	+375 29 771-28-64	dmitry.antonov@example.com	г. Барановичи, ул. Советская, 36	г. Барановичи, ул. Советская, 36	2026-06-05 11:08:06.121074+03	2026-06-05 11:08:06.121074+03
8	8	ПП	\N	\N	\N	123	123	2026-06-05 11:32:36.002232+03	2026-06-05 11:32:36.002232+03
4	4	Ковалева Мария Андреевна	1992-07-23	+375 33 684-12-55	maria.kovaleva@example.com	г. Барановичи, ул. Кирова, 21	г. Барановичи, ул. Кирова, 212	2026-06-05 11:08:06.121074+03	2026-06-05 11:46:53.220756+03
\.


--
-- TOC entry 3815 (class 0 OID 16391)
-- Dependencies: 220
-- Data for Name: registration_data; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.registration_data (id, fio, login, street, password_hash, created_at) FROM stdin;
1	Системный администратор	root	ул. Брестская, 12	$2b$10$/7avElWTS4zW4ESk7kxeqeTtWVlE8H93jK1XwnHgHd87xckZhf/Ey	2026-06-04 19:16:38.401946+03
3	Иван Петров	ivan.petrov	ул. Фроленкова, 8	$2b$10$PSJclcCpylVPi12wam3fiOtpWznj5N3jsxMCg.oXDZnUyPJhUYE0m	2026-06-05 11:08:06.121074+03
4	Мария Ковалева	maria.kovaleva	ул. Кирова, 21	$2b$10$41m5LlV6aegA7ktSo7R9z.eeVgUMef/MZ.qWsXcEQK76Vk6Rg6wX2	2026-06-05 11:08:06.121074+03
5	Павел Романов	pavel.romanov	ул. Жукова, 14	$2b$10$mGNiFMRmF9rtUHAmwE230eKnn90AKfttEAlfkQK9.L7Dt44w67bS.	2026-06-05 11:08:06.121074+03
6	Ольга Соколова	olga.sokolova	ул. Лисина, 5	$2b$10$NSaHpQGSSg9vwn3OFMFlnuYqAt9JlpqGf3ojtcOMyTQUfugvXcj/m	2026-06-05 11:08:06.121074+03
7	Дмитрий Антонов	dmitry.antonov	ул. Советская, 36	$2b$10$Hbb7/6w/GpJz4u1zcZHLmOg3yMF4lqyqiNStrpc2W6s0dNhs/h.8S	2026-06-05 11:08:06.121074+03
8	ПП	123	123	$2b$10$M0BDJiBBkMg5Q/AH/AKEY.UBhikC10w9nkMqNwmpJpIgXaBQWliuG	2026-06-05 11:32:36.002232+03
\.


--
-- TOC entry 3829 (class 0 OID 16536)
-- Dependencies: 234
-- Data for Name: telegram_payment_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.telegram_payment_orders (id, registration_id, amount, currency, payment_method, invoice_currency, invoice_amount, status, telegram_payload, telegram_chat_id, telegram_username, description, telegram_payment_charge_id, provider_payment_charge_id, raw_update, created_at, invoice_sent_at, paid_at, cancelled_at) FROM stdin;
1	1	25.00	BYN	telegram_stars	XTR	2500	paid	seed-payment-root-001	100000001	root_admin	Тестовая оплата администратора	seed_tg_root_001	seed_provider_root_001	{"seed": true, "login": "root", "payload": "seed-payment-root-001"}	2026-06-05 11:08:06.121074+03	2026-06-01 10:15:00+03	2026-06-01 10:17:00+03	\N
2	3	48.25	BYN	telegram_stars	XTR	4825	paid	seed-payment-ivan-001	100000002	ivan_petrov	Оплата услуг водоснабжения	seed_tg_ivan_001	seed_provider_ivan_001	{"seed": true, "login": "ivan.petrov", "payload": "seed-payment-ivan-001"}	2026-06-05 11:08:06.121074+03	2026-06-02 12:00:00+03	2026-06-02 12:04:00+03	\N
3	4	18.45	BYN	telegram_stars	XTR	1845	created	seed-payment-maria-001	100000003	maria_kovaleva	Счет на оплату задолженности	\N	\N	{"seed": true, "login": "maria.kovaleva", "payload": "seed-payment-maria-001"}	2026-06-05 11:08:06.121074+03	\N	\N	\N
\.


--
-- TOC entry 3835 (class 0 OID 0)
-- Dependencies: 223
-- Name: admins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.admins_id_seq', 2, true);


--
-- TOC entry 3836 (class 0 OID 0)
-- Dependencies: 229
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 16, true);


--
-- TOC entry 3837 (class 0 OID 0)
-- Dependencies: 225
-- Name: balances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.balances_id_seq', 8, true);


--
-- TOC entry 3838 (class 0 OID 0)
-- Dependencies: 227
-- Name: debtors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.debtors_id_seq', 6, true);


--
-- TOC entry 3839 (class 0 OID 0)
-- Dependencies: 231
-- Name: password_reset_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.password_reset_codes_id_seq', 2, true);


--
-- TOC entry 3840 (class 0 OID 0)
-- Dependencies: 221
-- Name: personalization_data_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.personalization_data_id_seq', 8, true);


--
-- TOC entry 3841 (class 0 OID 0)
-- Dependencies: 219
-- Name: registration_data_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.registration_data_id_seq', 8, true);


--
-- TOC entry 3842 (class 0 OID 0)
-- Dependencies: 233
-- Name: telegram_payment_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.telegram_payment_orders_id_seq', 3, true);


--
-- TOC entry 3633 (class 2606 OID 16448)
-- Name: admins admins_login_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_login_key UNIQUE (login);


--
-- TOC entry 3635 (class 2606 OID 16444)
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (id);


--
-- TOC entry 3637 (class 2606 OID 16446)
-- Name: admins admins_registration_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_registration_id_key UNIQUE (registration_id);


--
-- TOC entry 3647 (class 2606 OID 16512)
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3639 (class 2606 OID 16467)
-- Name: balances balances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.balances
    ADD CONSTRAINT balances_pkey PRIMARY KEY (id);


--
-- TOC entry 3641 (class 2606 OID 16469)
-- Name: balances balances_registration_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.balances
    ADD CONSTRAINT balances_registration_id_key UNIQUE (registration_id);


--
-- TOC entry 3643 (class 2606 OID 16491)
-- Name: debtors debtors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.debtors
    ADD CONSTRAINT debtors_pkey PRIMARY KEY (id);


--
-- TOC entry 3653 (class 2606 OID 16529)
-- Name: password_reset_codes password_reset_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_codes
    ADD CONSTRAINT password_reset_codes_pkey PRIMARY KEY (id);


--
-- TOC entry 3629 (class 2606 OID 16420)
-- Name: personalization_data personalization_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personalization_data
    ADD CONSTRAINT personalization_data_pkey PRIMARY KEY (id);


--
-- TOC entry 3631 (class 2606 OID 16422)
-- Name: personalization_data personalization_data_registration_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personalization_data
    ADD CONSTRAINT personalization_data_registration_id_key UNIQUE (registration_id);


--
-- TOC entry 3625 (class 2606 OID 16406)
-- Name: registration_data registration_data_login_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registration_data
    ADD CONSTRAINT registration_data_login_key UNIQUE (login);


--
-- TOC entry 3627 (class 2606 OID 16404)
-- Name: registration_data registration_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registration_data
    ADD CONSTRAINT registration_data_pkey PRIMARY KEY (id);


--
-- TOC entry 3658 (class 2606 OID 16562)
-- Name: telegram_payment_orders telegram_payment_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_payment_orders
    ADD CONSTRAINT telegram_payment_orders_pkey PRIMARY KEY (id);


--
-- TOC entry 3660 (class 2606 OID 16564)
-- Name: telegram_payment_orders telegram_payment_orders_telegram_payload_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_payment_orders
    ADD CONSTRAINT telegram_payment_orders_telegram_payload_key UNIQUE (telegram_payload);


--
-- TOC entry 3648 (class 1259 OID 16572)
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- TOC entry 3649 (class 1259 OID 16573)
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_table, entity_id);


--
-- TOC entry 3644 (class 1259 OID 16571)
-- Name: idx_debtors_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_debtors_is_active ON public.debtors USING btree (is_active);


--
-- TOC entry 3645 (class 1259 OID 16570)
-- Name: idx_debtors_registration_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_debtors_registration_id ON public.debtors USING btree (registration_id);


--
-- TOC entry 3650 (class 1259 OID 16574)
-- Name: idx_password_reset_codes_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_password_reset_codes_email ON public.password_reset_codes USING btree (lower(email));


--
-- TOC entry 3651 (class 1259 OID 16575)
-- Name: idx_password_reset_codes_registration_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_password_reset_codes_registration_id ON public.password_reset_codes USING btree (registration_id);


--
-- TOC entry 3654 (class 1259 OID 16577)
-- Name: idx_telegram_payment_orders_payload; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_telegram_payment_orders_payload ON public.telegram_payment_orders USING btree (telegram_payload);


--
-- TOC entry 3655 (class 1259 OID 16576)
-- Name: idx_telegram_payment_orders_registration_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_telegram_payment_orders_registration_id ON public.telegram_payment_orders USING btree (registration_id);


--
-- TOC entry 3656 (class 1259 OID 16578)
-- Name: idx_telegram_payment_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_telegram_payment_orders_status ON public.telegram_payment_orders USING btree (status);


--
-- TOC entry 3662 (class 2606 OID 16449)
-- Name: admins admins_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registration_data(id) ON DELETE CASCADE;


--
-- TOC entry 3663 (class 2606 OID 16470)
-- Name: balances balances_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.balances
    ADD CONSTRAINT balances_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registration_data(id) ON DELETE CASCADE;


--
-- TOC entry 3664 (class 2606 OID 16492)
-- Name: debtors debtors_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.debtors
    ADD CONSTRAINT debtors_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registration_data(id) ON DELETE CASCADE;


--
-- TOC entry 3665 (class 2606 OID 16530)
-- Name: password_reset_codes password_reset_codes_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_codes
    ADD CONSTRAINT password_reset_codes_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registration_data(id) ON DELETE CASCADE;


--
-- TOC entry 3661 (class 2606 OID 16423)
-- Name: personalization_data personalization_data_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.personalization_data
    ADD CONSTRAINT personalization_data_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registration_data(id) ON DELETE CASCADE;


--
-- TOC entry 3666 (class 2606 OID 16565)
-- Name: telegram_payment_orders telegram_payment_orders_registration_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.telegram_payment_orders
    ADD CONSTRAINT telegram_payment_orders_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registration_data(id) ON DELETE CASCADE;


-- Completed on 2026-06-06 12:05:46 +03

--
-- PostgreSQL database dump complete
--

\unrestrict lF5Zx4tfPDzSWnkiJkOAWC6lhCl5v4G4ykkpBRw6qib6bcQDEW5bv50eEy1i43F

