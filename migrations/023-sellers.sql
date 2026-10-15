CREATE TABLE sellers (
 id text PRIMARY KEY,
 current_version integer NOT NULL CHECK(current_version > 0),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100),
 active boolean NOT NULL,
 branch_ids text[] NOT NULL CHECK(cardinality(branch_ids) > 0)
);
CREATE TABLE seller_versions (
 seller_id text NOT NULL REFERENCES sellers(id),
 version integer NOT NULL CHECK(version > 0),
 data jsonb NOT NULL,
 PRIMARY KEY(seller_id,version)
);
CREATE TRIGGER seller_version_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON seller_versions
 FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
CREATE TABLE product_commissions (
 product_id text PRIMARY KEY REFERENCES catalog_products(id),
 current_version integer NOT NULL CHECK(current_version > 0)
);
CREATE TABLE product_commission_versions (
 product_id text NOT NULL REFERENCES product_commissions(product_id),
 version integer NOT NULL CHECK(version > 0),
 data jsonb NOT NULL,
 PRIMARY KEY(product_id,version)
);
CREATE TRIGGER product_commission_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON product_commission_versions
 FOR EACH STATEMENT EXECUTE FUNCTION protect_catalog_history();
