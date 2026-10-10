-- 이미 운영 중인 DB에서 status 컬럼을 추가했는데 place_with_stats 뷰에
-- status가 안 나올 때 실행. 뷰의 p.* 는 생성 시점 컬럼만 고정되므로 다시 만들어야 함.

drop view if exists place_with_stats;
create view place_with_stats as
select
  p.*,
  coalesce(round(avg(r.score), 1), 0) as avg_score,
  count(r.id)                         as review_count
from places p
left join reviews r on r.place_id = p.id
group by p.id;
