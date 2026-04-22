import React from 'react';
import { Input, Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

const SearchBar = ({ searchTerm, onSearchChange, onSearchSubmit }) => {
  return (
    <section className="flex items-center justify-center p-6 max-w-5xl mx-auto mt-6">
      <form onSubmit={onSearchSubmit} className="w-full flex gap-2">
        <Input
          value={searchTerm}
          onChange={onSearchChange}
          placeholder="Cari Wisata"
          size="large"
          className="shadow-md"
          style={{ borderRadius: '8px' }}
        />
        <Button
          type="primary"
          htmlType="submit"
          icon={<SearchOutlined />}
          size="large"
          className="search-button"
        >
          Search
        </Button>
      </form>

      {/* Tambahkan style langsung di komponen */}
      <style>{`
        .search-button {
          background-color: #6495ED;
          border-color: #6495ED;
          font-weight: 500;
          border-radius: 8px;
          transition: background-color 0.3s ease, box-shadow 0.3s ease;
        }

        .search-button:hover {
          background-color: #417de0; /* Biru lebih gelap saat hover */
          border-color: #417de0;
          box-shadow: 0 4px 10px rgba(100, 149, 237, 0.3);
        }
      `}</style>
    </section>
  );
};

export default SearchBar;
