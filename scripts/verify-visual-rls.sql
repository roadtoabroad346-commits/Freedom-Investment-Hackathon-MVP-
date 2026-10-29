begin;
create temporary table mx_visual_proof(proof jsonb) on commit drop;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();n integer;i integer;denied boolean;claimed boolean;proof jsonb:='{}';
begin
 insert into auth.users(id,email,role,aud,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values(a,'mirror-visual-'||a::text||'@example.invalid','authenticated','authenticated','{}','{}',now(),now()),(b,'mirror-visual-'||b::text||'@example.invalid','authenticated','authenticated','{}','{}',now(),now());
 perform set_config('request.jwt.claim.sub','',true);execute 'set local role anon';
 denied:=false;begin perform 1 from public.mx_market_workspaces;exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Anon workspace leak';end if;proof:=proof||'{"anonymous_denied":true}';
 execute 'reset role';perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';
 perform public.mx_save_market_workspace('{"version":1,"name":"temporary test"}',0);
 select count(*) into n from public.mx_market_workspaces where user_id=a and revision=1;if n<>1 then raise exception 'Owner save/read failed';end if;
 perform public.mx_save_market_workspace('{"version":1,"name":"updated test"}',1);proof:=proof||'{"owner_roundtrip":true}';
 denied:=false;begin perform public.mx_save_market_workspace('{}',1);exception when raise_exception then if sqlerrm='MX_CONFLICT' then denied:=true;else raise;end if;end;if not denied then raise exception 'Lost update';end if;proof:=proof||'{"optimistic_concurrency":true}';
 for i in 1..10 loop select public.mx_claim_ai_request() into claimed;if claimed is not true then raise exception 'Premature AI quota';end if;end loop;
 select public.mx_claim_ai_request() into claimed;if claimed is not false then raise exception 'AI quota bypass';end if;
 denied:=false;begin delete from mirror_x.ai_usage where user_id=a;exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'AI quota reset allowed';end if;proof:=proof||'{"ai_daily_quota":true,"ai_quota_cannot_reset":true}';
 execute 'reset role';perform set_config('request.jwt.claim.sub',b::text,true);execute 'set local role authenticated';
 select count(*) into n from public.mx_market_workspaces;if n<>0 then raise exception 'Cross-user leak';end if;
 delete from public.mx_market_workspaces where user_id=a;get diagnostics n=row_count;if n<>0 then raise exception 'Cross-user delete';end if;
 denied:=false;begin insert into mirror_x.market_workspaces(user_id,payload)values(a,'{}');exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Forged owner';end if;
 select public.mx_claim_ai_request() into claimed;if claimed is not true then raise exception 'Quota mixed users';end if;proof:=proof||'{"cross_user_read_write_denied":true,"forged_owner_denied":true,"independent_user_quota":true}';
 execute 'reset role';perform set_config('request.jwt.claim.sub',a::text,true);execute 'set local role authenticated';delete from public.mx_market_workspaces;get diagnostics n=row_count;if n<>1 then raise exception 'Owner delete';end if;proof:=proof||'{"owner_delete":true}';
 execute 'reset role';insert into mx_visual_proof values(proof||'{"all_passed":true,"rolled_back":true}');
end;$$;
select proof from mx_visual_proof;
rollback;
